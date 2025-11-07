import { Poppins } from 'next/font/google' // 1. Change to Poppins
import './globals.css'

// 2. Set up Poppins. It needs a 'weight' property.
const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['400', '700', '800'] // Load regular, bold, and extrabold
})

export const metadata = {
  title: 'My To-Do List',
  description: 'A to-do list app built with Next.js and Firebase',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* 3. Apply the Poppins className */}
      <body className={poppins.className}> 
        {children}
      </body>
    </html>
  )
}