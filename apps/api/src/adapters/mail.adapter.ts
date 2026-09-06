export interface MailAdapter {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}
