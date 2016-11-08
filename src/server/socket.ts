export type Client = number;
export type Binary = ArrayBuffer;
export type PacketReceiver = (packet: Packet) => void;

export interface Packet {
    client: Client;
    data: Binary;
}

export class SocketHandler {
    private m_out: PacketReceiver;
    private m_listeners: SocketListener[];

    constructor(out: PacketReceiver) {
        this.m_out = out;
        this.m_listeners = [];
    }

    public connect(client: Client) {
        for (let listener of this.m_listeners)
            listener.connect(client);
    }

    public disconnect(client: Client) {
        for (let listener of this.m_listeners)
            listener.disconnect(client);
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

export interface SocketListener {
    connect: (client: Client) => void;
    disconnect: (client: Client) => void;
    packet: (packet: Packet) => void;
}