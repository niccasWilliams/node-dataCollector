import { WebSocketServer, WebSocket } from "ws";
import { nowInBerlin } from "@/util/utils";

interface ChatClient {
    ws: WebSocket;
    chatId: number;
}

interface UserClient {
    ws: WebSocket;
    userId: number;
}

class WebsocketService {
    private wss: WebSocketServer;
    private chatClients: ChatClient[] = [];
    private userClients: UserClient[] = [];

    constructor(wss: WebSocketServer) {
        this.wss = wss;

        console.log("WebSocket-Server initialisiert");

        this.wss.on("connection", (ws, req) => {
            console.log("Neue WebSocket-Verbindung von:", req.socket.remoteAddress);

            ws.on("message", (message) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());
                    const { chatId, userId } = parsedMessage;

                    if (chatId !== undefined) {
                        this.addClientToChat(ws, chatId);
                    }

                    if (userId !== undefined) {
                        this.addClientToUser(ws, userId);
                    }
                } catch (err) {
                    console.error("Fehler beim Parsen der WebSocket-Nachricht:", err);
                }
            });

            ws.on("close", () => {
                this.removeClient(ws);
                console.log("WebSocket-Verbindung geschlossen");
            });
        });
    }


    private removeClient(ws: WebSocket) {
        this.chatClients = this.chatClients.filter(client => client.ws !== ws);
        this.userClients = this.userClients.filter(client => client.ws !== ws);
    }





    // ========== Chat Clients ==========
    private addClientToChat(ws: WebSocket, chatId: number) {
        const existingClient = this.chatClients.find(client => client.ws === ws);

        if (!existingClient) {
            this.chatClients.push({ ws, chatId });
            console.log(`Client zu Chat ${chatId} hinzugefügt.`);
        } else if (existingClient.chatId !== chatId) {
            existingClient.chatId = chatId;
            console.log(`Client zu neuem Chat ${chatId} gewechselt.`);
        }
    }

    sendMessageToChatClients(chatId: number, messageData: any) {
        let clientsSent = 0;

        this.chatClients.forEach(client => {
            if (client.chatId === chatId) {
                try {
                    client.ws.send(JSON.stringify({
                        type: 'new_message',
                        data: messageData
                    }));
                    clientsSent++;
                } catch (error) {
                    console.error("Fehler beim Senden der WebSocket-Nachricht:", error);
                }
            }
        });

        console.log(`Nachricht an ${clientsSent} Clients in Chat ${chatId} gesendet.`);
    }

    sendReadToChatClients(chatId: number, messageIds: number[], readByUserId: number) {
        this.chatClients.forEach(client => {
            if (client.chatId === chatId) {
                try {
                    client.ws.send(JSON.stringify({
                        type: 'read_message',
                        data: { userId: readByUserId, messageIds, readAt: nowInBerlin() }
                    }));
                } catch (error) {
                    console.error("Fehler beim Senden der WebSocket-Nachricht:", error);
                }
            }
        });
        console.log(`Read Info an Chat ${chatId} gesendet.`);
    }

    public listChatClients() {
        return this.chatClients.map(client => ({
            chatId: client.chatId,
            wsState: client.ws.readyState
        }));
    }









    // ========== User Clients ==========
    private addClientToUser(ws: WebSocket, userId: number) {
        const existingClient = this.userClients.find(client => client.ws === ws);

        if (!existingClient) {
            this.userClients.push({ ws, userId });
            console.log(`Client zu User ${userId} hinzugefügt.`);
        } else if (existingClient.userId !== userId) {
            existingClient.userId = userId;
            console.log(`Client zu neuem User ${userId} gewechselt.`);
        }
    }

  

    public listUserClients() {
        return this.userClients.map(client => ({
            userId: client.userId,
            wsState: client.ws.readyState
        }));
    }
}

export { WebsocketService };