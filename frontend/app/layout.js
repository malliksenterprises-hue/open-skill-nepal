import { AuthProvider } from '../contexts/AuthContext';
import './globals.css';

export const metadata = {
  title: 'Open Skill Nepal',
  description: 'Empowering education through technology',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
