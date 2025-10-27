


export type ExternalUserId = number;
export type EmployeeId = number;
export type Languages = "DE" | "EN";
export const REQUIRED_LANG_COUNT = 2;

export type Currency = "EUR";




export type RequestResponce = {
    success: boolean,
    message: string,
    data: any
}

export type GenericRequestResponse<T = any> = {
    success: boolean;
    message: string;
    data?: T;
};


export type Base64FilePart = {
    field: string;               // z.B. "video", "thumbnail"
    fileName: string;
    mimeType: string;
    base64String: string;
    size?: number;
};

export type FileData = {
    field?: string;              // optional, wenn aus single-legacy kommt
    fileName: string;
    mimeType: string;
    fileBuffer: Buffer;
    size?: number;
};






//APP TYPES

