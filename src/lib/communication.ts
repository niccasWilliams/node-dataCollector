


import axios from "axios";
import { Response } from "express";
import { GenericRequestResponse, RequestResponce } from "@/types/types";




export async function sendToFrontendAPI(route: string, data: any) {
    let FRONTEND_HOST = "localhost:3000"
    if (process.env.FRONTEND_HOST_NAME !== "localhost") {
        FRONTEND_HOST = process.env.FRONTEND_HOST_NAME || "localhost:3000";
    }

    const FRONTEND_API_URL = process.env.FRONTEND_HOST_NAME !== "localhost" ? `https://${process.env.FRONTEND_HOST_NAME}/api${route}` : `http://localhost:3000/api${route}`

    try {

        const response = await axios.post(FRONTEND_API_URL, data, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.FRONTEND_API_KEY}`
            },
        });
        console.log("SEND TO FRONTEND: ", FRONTEND_API_URL, data)
        return response;
    } catch (error: any) {
        console.error("failed to send request to: ", FRONTEND_API_URL)
        throw error.message
    }
}

export async function sendToFrontendAPIGet(route: string) {
    const FRONTEND_HOST = process.env.FRONTEND_HOST_NAME !== "localhost"
        ? process.env.FRONTEND_HOST_NAME
        : "localhost:3000";

    const FRONTEND_API_URL =
        process.env.FRONTEND_HOST_NAME !== "localhost"
            ? `https://${FRONTEND_HOST}/api${route}`
            : `http://localhost:3000/api${route}`;

    try {
        const response = await axios.get(FRONTEND_API_URL, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.FRONTEND_API_KEY}`
            },
        });

        console.log("SEND TO FRONTEND: ", FRONTEND_API_URL);
        return response;
    } catch (error: any) {
        console.error("❌ Failed to send request to: ", FRONTEND_API_URL);
        throw error.message;
    }
}



export function responseHandler(res: Response, statusCode: number, message?: string, data?: any) {
    const successStatusCodes = [200, 201, 204];
    const success = successStatusCodes.includes(statusCode);

    const defaultMessage = success ? undefined : "An error occurred";

    return res.status(statusCode).json({
        success,
        message: message || defaultMessage,
        data: data || null,
    });
}


