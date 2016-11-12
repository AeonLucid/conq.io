export type Client = number;
export type Binary = ArrayBuffer;
export const padding = 2;

interface DataPacket {
    client: Client;
    data: Binary;
}

interface StatePacket {
    client: Client;
}

type StateListener = (packet: StatePacket) => void;
type PacketListener = (packet: DataPacket) => void;

export class SocketHandler {
    private m_out: PacketListener;
    private m_listeners: SocketListener[];

    constructor(out: PacketListener) {
        this.m_out = out;
        this.m_listeners = [];
    }

    public connect(client: Client) {
        for (let listener of this.m_listeners)
            listener.connect({ client: client });
    }

    public disconnect(client: Client) {
        for (let listener of this.m_listeners)
            listener.disconnect({ client: client });
    }

    public packet(client: Client, data: Binary) {
        for (let listener of this.m_listeners)
            listener.packet({ client: client, data: data });
    }

    public attach(listener: SocketListener) {
        this.m_listeners.push(listener);
    }

    public get out() {
        return this.m_out;
    }
}

interface SocketListener {
    connect: (client: StatePacket) => void;
    disconnect: (packet: StatePacket) => void;
    packet: (packet: DataPacket) => void;
}

interface ResolverManagerObject {
    main: number;
    sub: number;
    receiver: PacketListener;
}

class ResolverManager {
    private m_resolvers: ResolverManagerObject[];
    
    constructor() {
        this.m_resolvers = [];
    }

    public set(main: number, sub: number, receiver: PacketListener) {
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

    public call(main: number, sub: number, packet: DataPacket) {
        for (let resolver of this.m_resolvers) {
            if (resolver.main === main && resolver.sub === sub) {
                resolver.receiver(packet);
            }
        }
    }
}

interface ResolverStateWrapper {
    listener: StateListener;
}

class ResolverStateBinder {
    private m_stateListener: ResolverStateWrapper;

    constructor(stateListener: ResolverStateWrapper) {
        this.m_stateListener = stateListener;
    }

    public do(callback: StateListener) {
        this.m_stateListener.listener = callback;
    }

    public ignore() {
        this.m_stateListener.listener = (packet) => { };
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

    public do(callback: PacketListener) {
        for (let sub of this.m_subs) {
            this.m_manager.set(this.m_main, sub, callback);
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
    private m_openListener: ResolverStateWrapper;
    private m_closeListener: ResolverStateWrapper;

    constructor(manager: ResolverManager, openListener: ResolverStateWrapper, closeListener: ResolverStateWrapper) {
        this.m_manager = manager;
        this.m_openListener = openListener;
        this.m_closeListener = closeListener;
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

    public get open() {
        return new ResolverStateBinder(this.m_openListener);
    }

    public get close() {
        return new ResolverStateBinder(this.m_closeListener);
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
    private m_out: PacketListener;
    private m_clientProperty: ClientProperty;

    constructor(data: Binary, out: PacketListener, ClientProperty: ClientProperty) {
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
    private m_out: PacketListener;
    private m_clients: Set<Client>;
    private m_resolverManager: ResolverManager;
    private m_openListener: ResolverStateWrapper;
    private m_closeListener: ResolverStateWrapper;

    constructor(handler: SocketHandler) {
        this.setupListener(handler);    
        
        this.m_clients = new Set<Client>();
        this.m_resolverManager = new ResolverManager();
        this.m_openListener = { listener: () => { } };
        this.m_closeListener = { listener: () => { } };
    }

    private setupListener(handler: SocketHandler) {
        let listener: SocketListener = {
            connect: packet => {
                this.m_clients.add(packet.client);
                this.m_openListener.listener(packet);
            },

            disconnect: packet => {
                this.m_clients.delete(packet.client);
                this.m_closeListener.listener(packet);
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
        return new ResolverProperty(this.m_resolverManager,
            this.m_openListener, this.m_closeListener);
    }
}