export type MessageSenderType = 'customer' | 'bot' | 'agent' | 'system';
export type MessageContentType = 'text' | 'image' | 'file' | 'template';

export interface MessageDTO {
  id: string;
  ticketId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  content: string;
  contentType: MessageContentType;
  isInternal: boolean;
}
