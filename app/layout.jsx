import { Outfit } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import StoreProvider from '@/app/StoreProvider'
import AuthProvider from '@/app/AuthProvider'
import CartSync from '@/components/CartSync'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600'] })

export const metadata = {
  title: 'Dastiyab. - Shop smarter',
  description: 'Dastiyab. - Shop smarter',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} antialiased`}>
        <AuthProvider>
          <StoreProvider>
            <CartSync />
            <Toaster />
            {children}
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
