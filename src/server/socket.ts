export type Client = number;
export type Binary = ArrayBuffer;
export const padding = 2;

type StateListener = (packet: StatePacket) => void;
type PacketListener = (packet: DataPacket) => void;
type RawPacketListener = (packet: RawDataPacket) => void;
type BasicPacketIOBuilder = <Input, Output>(inputCodec: Serializer<Input>, outputCodec: Serializer<Output>)
    => BasicPacketIO<Input, Output>;
type BasicPacketInputBuilder = <Input>(inputCodec: Serializer<Input>) => BasicPacketInput<Input>;

interface RawDataPacket {
    client: Client;
    data: Binary;
}

interface RawStatePacket {
    client: Client;
}

export interface DataPacket {
    from: Client;
    raw: Binary;
    bpio: BasicPacketIOBuilder;
    bpi: BasicPacketInputBuilder;
    app: Application;
}

export interface StatePacket {
    from: Client;
    app: Application;
}

class BasicPacketIO<Input, Output> {
    private m_app: Application;
    private m_outputCodec: Serializer<Output>;
    private m_input: Input | undefined;
    private m_client: Client;
    private m_raw: Binary;
    private m_main: number;
    private m_sub: number;

    constructor(app: Application, client: Client, raw: Binary, inputCodec: Serializer<Input>,
        outputCodec: Serializer<Output>, main: number, sub: number) {
        this.m_app = app;
        this.m_outputCodec = outputCodec;
        this.m_client = client;
        this.m_raw = raw;
        this.m_main = main;
        this.m_sub = sub;
        this.m_input = inputCodec.decode(raw, padding);
    }

    public get valid() {
        return this.m_input !== undefined;
    }

    public get input(): Input {
        if (!this.valid)
            throw new Error("Given packet is not valid");
        return this.m_input!;
    }

    public send(output: Output) {
        let outputBinary = this.m_outputCodec.encode(output, padding);
        this.m_app.send(outputBinary, this.m_main, this.m_sub).where(this.m_client);
    }
}

class BasicPacketInput<Input> {
    private m_app: Application;
    private m_input: Input | undefined;
    private m_client: Client;
    private m_raw: Binary;

    constructor(app: Application, client: Client, raw: Binary, inputCodec: Serializer<Input>) {
        this.m_app = app;
        this.m_client = client;
        this.m_raw = raw;
        this.m_input = inputCodec.decode(raw, padding);
    }

    public get valid() {
        return this.m_input !== undefined;
    }

    public get input(): Input {
        if (!this.valid)
            throw new Error("Given packet is not valid");
        return this.m_input!;
    }
}

function genBasicPacketIOBuilder(app: Application, client: Client, raw: Binary,
    main: number, sub: number): BasicPacketIOBuilder {

    return function builder<Input, Output>
        (inputCodec: Serializer<Input>, outputCodec: Serializer<Output>): BasicPacketIO<Input, Output> {
        
        return new BasicPacketIO<Input, Output>(app, client, raw, inputCodec, outputCodec, main, sub);
    }
}

function genBasicPacketInputBuilder(app: Application, client: Client, raw: Binary): BasicPacketInputBuilder {
    return function builder<Input>
        (inputCodec: Serializer<Input>): BasicPacketInput<Input> {
        
        return new BasicPacketInput<Input>(app, client, raw, inputCodec);
    }
}

export class SocketHandler {
    private m_out: RawPacketListener;
    private m_listeners: SocketListener[];

    constructor(out: RawPacketListener) {
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
    connect: (client: RawStatePacket) => void;
    disconnect: (packet: RawStatePacket) => void;
    packet: (packet: RawDataPacket) => void;
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
            result = [...this.m_clients].filter(client => selector(client));
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

class ClientSelector {
    private m_callback: (client: Client) => void;
    private m_clientProperty: ClientProperty;

    constructor(callback: (client: Client) => void, clientProperty: ClientProperty) {
        this.m_callback = callback;
        this.m_clientProperty = clientProperty;
    }

    public where(selection: Client | Client[] | ((client: Client) => boolean)) {
        let clients = this.m_clientProperty.select(selection);
        for (let client of clients)
            this.m_callback(client);
    }

    public all() {
        let clients = this.m_clientProperty.select(client => true);
        for (let client of clients)
            this.m_callback(client);
    }
}

class Application {
    private m_out: RawPacketListener;
    private m_clients: Set<Client>;

    constructor(out: RawPacketListener, clients: Set<Client>) {
        this.m_out = out;
        this.m_clients = clients;
    }

    public send(data: Binary, main: number, sub: number) {
        new DataView(data).setUint16(0, (main & 0x000F) << 12 | (sub & 0x0FFF)); 

        return new ClientSelector(client => {
            this.m_out({ client: client, data: data });
        }, this.client);
    }

    public serialize<T>(codec: Serializer<T>, main: number, sub: number) {
        return (object: T) => {
            return this.send(codec.encode(object, padding), main, sub);
        }
    }

    public get client() {
        return new ClientProperty(this.m_clients);
    }
}

export abstract class Serializer<T> {
	public abstract encode(object: T, padding: number): ArrayBuffer;
    public abstract decode(binary: ArrayBuffer, padding: number): T | undefined;
}

export class Server {
    private m_app: Application;
    private m_out: RawPacketListener;
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
        this.m_app = new Application(this.m_out, this.m_clients);
    }

    private setupListener(handler: SocketHandler) {
        let listener: SocketListener = {
            connect: packet => {
                this.m_clients.add(packet.client);
                this.m_openListener.listener({ app: this.m_app, from: packet.client });
            },

            disconnect: packet => {
                this.m_clients.delete(packet.client);
                this.m_closeListener.listener({ app: this.m_app, from: packet.client });
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
        this.m_resolverManager.call(main, sub, {
            app: this.m_app,
            bpi: genBasicPacketInputBuilder(this.m_app, client, data),
            bpio: genBasicPacketIOBuilder(this.m_app, client, data, main, sub), 
            from: client,
            raw: data
        });
    }

    public get app() {
        return this.m_app;
    }

    public get on() {
        return new ResolverProperty(this.m_resolverManager, this.m_openListener, this.m_closeListener);
    }
}