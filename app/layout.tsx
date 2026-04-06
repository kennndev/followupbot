import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'FollowUp Bot — Doctor Dashboard',
  description: 'AI-powered patient follow-up reminder system',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
