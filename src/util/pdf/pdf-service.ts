
import { ReactElement } from 'react';
import { s3Service } from '../../lib/s3.service';
import { Readable } from 'stream';


class PdfService {

  


    validateBase64Pdf(base64: string): boolean {
        try {
            if (!base64 || typeof base64 !== 'string') {
                console.error("❌ Base64 input is not a string");
                return false;
            }

            // 1. Base64-Format check (RFC 4648)
            const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
            if (!base64Pattern.test(base64)) {
                console.error("❌ Base64 format is invalid");
                return false;
            }

            // 2. Decode to buffer
            const buffer = Buffer.from(base64, 'base64');

            if (!buffer || buffer.length === 0) {
                console.error("❌ Decoded buffer is empty");
                return false;
            }

            // 3. Check for PDF header
            const header = buffer.toString('ascii', 0, 8);
            const hasPdfHeader = header.startsWith('%PDF-');

            // 4. Check for EOF marker (last ~50 chars)
            const trailer = buffer.toString('ascii', Math.max(0, buffer.length - 50));
            const hasPdfFooter = trailer.includes('%%EOF');

            const isValid = hasPdfHeader && hasPdfFooter;

            console.log("📄 Base64 PDF check:");
            console.log("- Starts with '%PDF-':", hasPdfHeader);
            console.log("- Ends with '%%EOF':", hasPdfFooter);
            console.log("- Buffer length:", buffer.length);

            return isValid;

        } catch (error) {
            console.error("❌ Failed to validate Base64 PDF:", error);
            return false;
        }
    }

    async renderPdfToBuffer(component: ReactElement): Promise<Buffer> {
        try {
            const { pdf } = await import('@react-pdf/renderer');
            console.log('🔄 Starting PDF generation...');

            const pdfInstance = pdf();
            pdfInstance.updateContainer(component);

            // Warte explizit auf die PDF-Generierung
            const blob = await pdfInstance.toBlob();

            // Konvertiere Blob zu Buffer
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            console.log('✅ PDF buffer created successfully, size:', buffer.length, 'bytes');

            // ERWEITERTE VALIDIERUNG
            if (buffer.length === 0) {
                throw new Error('Generated PDF buffer is empty');
            }

            // Mindestgröße prüfen - ein gültiges PDF sollte mindestens 1KB haben
            if (buffer.length < 1024) {
                console.warn('⚠️ PDF seems unusually small:', buffer.length, 'bytes');
            }

            // PDF-Header prüfen
            const header = buffer.toString('ascii', 0, 8);
            if (!header.startsWith('%PDF-')) {
                throw new Error(`Invalid PDF header: ${header}`);
            }

            // PDF-Trailer prüfen (sollte mit %%EOF enden)
            const trailer = buffer.toString('ascii', -10);
            if (!trailer.includes('%%EOF')) {
                console.warn('⚠️ PDF does not end with proper EOF marker');
            }

            // Versuche den gesamten Buffer als ASCII zu lesen für Debug
            console.log('📄 PDF content preview (first 100 chars):');
            console.log(buffer.toString('ascii', 0, 100));



            await this.validatePdfContent(buffer)



            return buffer;
        } catch (error: any) {
            console.error('❌ Error generating PDF buffer:', error);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    async validatePdfContent(buffer: Buffer): Promise<boolean> {
        try {
            // Basic PDF structure checks
            const content = buffer.toString('ascii');

            // Prüfe auf wichtige PDF-Elemente
            const hasHeader = content.startsWith('%PDF-');
            const hasEOF = content.includes('%%EOF');
            const hasXref = content.includes('xref');
            const hasTrailer = content.includes('trailer');

            console.log('📋 PDF Structure Check:');
            console.log('- Has PDF header:', hasHeader);
            console.log('- Has EOF marker:', hasEOF);
            console.log('- Has xref table:', hasXref);
            console.log('- Has trailer:', hasTrailer);
            console.log('- Buffer size:', buffer.length, 'bytes');

            const isValid = hasHeader && hasEOF && buffer.length > 100; // Mindestgröße

            if (!isValid) {
                console.error('❌ PDF structure validation failed');
                console.log('PDF content (first 200 chars):', content.substring(0, 200));
                console.log('PDF content (last 50 chars):', content.substring(content.length - 50));
            }



            return isValid;
        } catch (error) {
            console.error('❌ PDF validation error:', error);
            return false;
        }
    }


    async uploadPDFBufferUseCase(key: string, buffer: Buffer): Promise<{ key: string; url: string }> {
        try {
            const { success } = await s3Service.uploadFile(
                buffer,
                key,
                "application/pdf"
            );

            if (!success) throw new Error("❌ PDF-Upload nach S3 fehlgeschlagen");

            const url = await s3Service.getDownloadUrl(key);

            return { key, url };
        } catch (error: any) {
            throw new Error(`PDF upload failed: ${error.message}`);
        }

    }

    async streamPdfFromS3(key: string): Promise<{ stream: Readable; size?: number }> {



        try {
            const stream = await s3Service.getObjectStream(key);
            if (!stream) throw new Error(`❌ Kein Stream für PDF mit Schlüssel ${key} gefunden`);
            return stream;
        } catch (error) {
            console.error(`❌ Error streaming PDF from S3 for key ${key}:`, error);
            throw error;
        }
    }


}

export const pdfService = new PdfService();