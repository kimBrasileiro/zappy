export type TicketChannel = 'site_chat' | 'whatsapp';
export type TicketStatus =
  | 'open'
  | 'bot_active'
  | 'waiting_human'
  | 'in_progress'
  | 'resolved'
  | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TicketDTO {
  id: string;
  companyId: string;
  customerId: string | null;
  assignedTo: string | null;
  channel: TicketChannel;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string | null;
  tags: string[];
}
