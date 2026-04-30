import "./globals.css";

export const metadata = {
  title: "Mileage Reimbursement",
  description: "Calculate work mileage and submit reimbursement requests."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
