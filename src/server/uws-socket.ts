import wsw = require("./socket");
import http = require("http");

let uws = require("uws");

class Socket {
    private m_socket: any;
    private m_clients: { client: wsw.Client, socket: any }[];
    private m_handler: wsw.SocketHandler;
    private static s_uniqueIdentifier = 0;

    constructor(server: http.Server) {
        this.m_socket = new uws.Server({ server: server });
        this.m_socket.startAutoPing(100);
        this.m_clients = [];

        this.m_handler = new wsw.SocketHandler(packet => {
            for (let client of this.m_clients) {
                if (client.client === packet.client) {
                    client.socket.send(packet.data);
                }
            }
        });

        this.m_socket.on("connection", socket => {
            Socket.initSocket(socket);
            this.m_clients.push({ client: Socket.getIdentifier(socket), socket: socket });
            this.m_handler.connect(Socket.getIdentifier(socket));
            socket.on("message", packet => {
                if (packet instanceof ArrayBuffer)
                    this.m_handler.packet(Socket.getIdentifier(socket), <ArrayBuffer>packet);
            });

            socket.on("close", () => {
                this.m_handler.disconnect(Socket.getIdentifier(socket));
                let client = Socket.getIdentifier(socket);
                for (let i = this.m_clients.length - 1; i >= 0; i--) {
                    if (this.m_clients[i].client === client) {
                        this.m_clients.splice(i, 1);
                        return;
                    }
                }
                throw new Error("Unexpected error; unregisted client disconnected from the server");
            });
        });
    }

    public get handler(): wsw.SocketHandler {
        return this.m_handler;
    }

    private static initSocket(socket: any) {
        socket.__$identifier = Socket.s_uniqueIdentifier++;
    }

    private static getIdentifier(socket: any): number {
        return <number>(socket.__$identifier);
    }
}

export = function (server: http.Server) {
    return new Socket(server);
}