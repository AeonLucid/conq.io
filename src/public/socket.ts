type Binary = ArrayBuffer;
type PacketReceiver = (packet: Packet) => void;
let padding = 2;

type StateListener = () => void;

interface Packet {
    data: Binary;
}

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
        this.m_stateListener.listener = () => { };
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

    public do(callback: PacketReceiver) {
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

class Socket {
    private m_socket: WebSocket;
    private m_resolverManager: ResolverManager;
    private m_open: boolean = false;
    private m_openListener: ResolverStateWrapper;
    private m_closeListener: ResolverStateWrapper;

    constructor(url: string) {
        this.m_resolverManager = new ResolverManager();
        this.m_socket = new WebSocket(url);
        this.m_socket.binaryType = "arraybuffer";
        this.m_openListener = { listener: () => { } };
        this.m_closeListener = { listener: () => { } };

        this.m_socket.onmessage = event => {
            let data = <ArrayBuffer>event.data;
            let view = new DataView(data);
            let header = view.getUint16(0);

            let main = (header & 0xF000) >> 12;
            let sub = header & 0x0FFF;
            this.m_resolverManager.call(main, sub, { data: data });
        }

        this.m_socket.onopen = () => {
            this.m_open = true;
            this.m_openListener.listener();
        }

        this.m_socket.onclose = () => {
            this.m_open = false;
            this.m_closeListener.listener();
        }
    }

    public send(data: Binary) {
        this.m_socket.send(data);
    }

    public get on() {
        return new ResolverProperty(this.m_resolverManager,
            this.m_openListener, this.m_closeListener);
    }
}