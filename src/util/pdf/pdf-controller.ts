import { Request, Response } from 'express';
import { responseHandler } from '../../lib/communication';
import { pdfService } from './pdf-service';





class PdfController {


    //not used currently
    async streamBase64(req: Request, res: Response) {
        try {
            const { base64 } = req.body;

            if (!base64 || typeof base64 !== 'string') {
                return responseHandler(res, 400, 'Invalid or missing base64 string');
            }

            // Validate Base64 PDF
            if (!pdfService.validateBase64Pdf(base64)) {
                return responseHandler(res, 400, 'Invalid Base64 PDF format');
            }

            // Set headers for streaming
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="invoice.pdf"');

            // Decode Base64 and stream to response
            const buffer = Buffer.from(base64, 'base64');
            res.write(buffer);
            res.end();

        } catch (error: any) {
            console.error('Error in streamBase64:', error);
            return responseHandler(res, 500, error.message || 'Internal Server Error');
        }
    }


   

}

export const pdfController = new PdfController();