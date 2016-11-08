import socket = require("./socket");

export type Binary = socket.Binary;
export type Client = socket.Client;
export const padding = 2;

export interface Packet {
    client: Client;
    data: Binary;
}

type RawPacketReceiver = socket.PacketReceiver;
type PacketReceiver = (packet: Packet) => void;

interface ResolverManagerObject {
    main: number;
    sub: number;
    receiver: PacketReceiver;
}

class ResolverManager {
    private m_resolvers: ResolverManagerObject[];
    
    constructor() {
        this.m_resolvers = [];
    }

    public set(main: number, sub: number, receiver: PacketReceiver) {
        for (let resolver of this.m_resolvers) {
            if (resolver.main === main && resolver.sub === sub) {
                resolver.receiver = receiver;
                return;
            }
        }

        this.m_resolvers.push({ main: main, sub: sub, receiver: receiver });
    }

    public unset(main: number, sub: number) {
        for (let i = 0; i < this.m_resolvers.length; i++) {
            let resolver = this.m_resolvers[i];

            if (resolver.main === main && resolver.sub === sub) {
                this.m_resolvers.splice(i, 1);
                return;
            }
        }
    }

    public call(main: number, sub: number, packet: Packet) {
        for (let resolver of this.m_resolvers) {
            if (resolver.main === main && resolver.sub === sub) {
                resolver.receiver(packet);
            }
        }
    }
}

class ResolverBinder {
    private m_manager: ResolverManager;
    private m_main: number;
    private m_subs: number[];

    constructor(manager: ResolverManager, main: number, subs: number[]) {
        this.m_manager = manager;
        this.m_main = main;
        this.m_subs = subs;
    }

    public do(callback: PacketReceiver | PacketReceiver[]) {
        if (callback instanceof Array) {
            let receivers = <PacketReceiver[]>callback;
        
            for (let sub of this.m_subs) {
                for (let receiver of receivers) {
                    this.m_manager.set(this.m_main, sub, receiver);
                }
            }
        } else {
            let receiver = <PacketReceiver>callback;
            this.do([receiver]);
        }
    }

    public ignore() {
        for (let sub of this.m_subs) {
            this.m_manager.unset(this.m_main, sub);
        }
    }
}

class ResolverProperty {
    private m_manager: ResolverManager;

    constructor(manager: ResolverManager) {
        this.m_manager = manager;
    }

    public system(sub: number | number[]) {
        return new ResolverBinder(this.m_manager, 0x00, this.subArray(sub));
    }

    public game(sub: number | number[]) {
        return new ResolverBinder(this.m_manager, 0x01, this.subArray(sub));
    }

    public debug(sub: number | number[]) {
        return new ResolverBinder(this.m_manager, 0x02, this.subArray(sub));
    }

    private subArray(raw: number | number[]) {
        if (raw instanceof Array) {
            return <number[]>raw;
        } else {
            return [<number>raw];
        }
    }
}

class ClientProperty {
    private m_clients: Set<Client>;

    constructor(clients: Set<Client>) {
        this.m_clients = clients;
    }
    
    public select(selection: Client | Client[] | ((client: Client) => boolean)): Client[] {
        let result: Client[] = [];
        if (selection instanceof Array) {
            let clients = <Client[]>(selection);
            for (let client of clients) {
                if (this.m_clients.has(client))  
                    result.push(client);
            }
        } else if (selection instanceof Function) {
            let selector = <(client: Client) => boolean>(selection);
            result = [...this.m_clients].filter(client => !selector(client));
        } else {
            let client = <Client>(selection);
            result.push(client);
        }

        return result;
    }

    public exist(client: Client | Client[]) {
        if (client instanceof Array) {
            let clients = <Client[]>(client);
            let selected = this.select(clients);

            // Check if clients and selection are equal
            if (clients.length !== selected.length)
                return false;
            for (let i = 0; i < clients.length; i++) {
                if (clients[i] !== selected[i])
                    return false;
            }

            return true;
        } else {
            this.exist([<Client>client]);
        }
    }
}

class SendSelector {
    private m_data: Binary;
    private m_out: RawPacketReceiver;
    private m_clientProperty: ClientProperty;

    constructor(data: Binary, out: RawPacketReceiver, ClientProperty: ClientProperty) {
        this.m_data = data;
        this.m_out = out;
        this.m_clientProperty = ClientProperty;
    }

    public to(selection: Client | Client[] | ((client: Client) => boolean)) {
        let clients = this.m_clientProperty.select(selection);
        for (let client of clients)
            this.m_out({ client: client, data: this.m_data });
    }
}

export class Server {
    private m_out: RawPacketReceiver;
    private m_clients: Set<Client>;
    private m_resolverManager: ResolverManager;

    constructor(handler: socket.SocketHandler) {
        this.setupListener(handler);    
        
        this.m_clients = new Set<Client>();
        this.m_resolverManager = new ResolverManager();
    }

    private setupListener(handler: socket.SocketHandler) {
        let listener: socket.SocketListener = {
            connect: client => {
                this.m_clients.add(client);
            },

            disconnect: client => {
                this.m_clients.delete(client);
            },

            packet: packet => {
                this.onPacket(packet.client, packet.data);        
            }
        }
        handler.attach(listener);
        this.m_out = handler.out;
    }

    private onPacket(client: Client, data: Binary) {
        let view = new DataView(data);
        
        // Invalid packet, ignore it
        if (view.byteLength < 2)
            return;

        let header = view.getUint16(0);
        let main = (header & 0xF000) >> 12;
        let sub = header & 0x0FFF;
        this.m_resolverManager.call(main, sub, { client: client, data: data });
    }

    public send(data: Binary) {
        return new SendSelector(data, this.m_out, this.client);
    }

    public get client() {
        return new ClientProperty(this.m_clients);
    }

    public get on() {
        return new ResolverProperty(this.m_resolverManager);
    }
}
