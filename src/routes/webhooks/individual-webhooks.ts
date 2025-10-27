//NOT SYNCED TEMPLATE FILE 
import { TrackedWebhook } from "./webhook.tracker";
import { WebhookPayload, webhookUseCase } from "./webhook.useCase";


export class IndividualWebhooks {

    async trackStripeWebhook(
        externalId: string,
        eventType: string,
        payload: WebhookPayload
    ): Promise<TrackedWebhook | null> {
        return webhookUseCase.trackIncomingWebhook({
            externalId,
            provider: 'stripe',
            eventType,
            payload,
        });
    }

    async trackPaypalWebhook(
        externalId: string,
        eventType: string,
        payload: WebhookPayload
    ): Promise<TrackedWebhook | null> {
        return webhookUseCase.trackIncomingWebhook({
            externalId,
            provider: 'paypal',
            eventType,
            payload,
        });
    }


    async trackPrintfulWebhook(
        externalId: string,
        eventType: string,
        payload: WebhookPayload
    ): Promise<TrackedWebhook | null> {
        return webhookUseCase.trackIncomingWebhook({
            externalId,
            provider: 'printful',
            eventType,
            payload,
        });
    }

    async trackLexofficeWebhook(
        externalId: string,
        eventType: string,
        payload: WebhookPayload
    ): Promise<TrackedWebhook | null> {
        return webhookUseCase.trackIncomingWebhook({
            externalId,
            provider: 'lexoffice',
            eventType,
            payload,
        });
    }
}

export const individualWebhooks = new IndividualWebhooks();
