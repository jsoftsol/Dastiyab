'use client'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'

export default function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!session?.user) return null

  const { name, email, image } = session.user
  const initials = name ? name.charAt(0).toUpperCase() : '?'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 focus:outline-none"
      >
        {image ? (
          <Image
            src={image}
            alt={name || 'User'}
            width={32}
            height={32}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-semibold">
            {initials}
          </div>
        )}
        <span className="hidden sm:block text-sm font-medium text-slate-700">
          {name || email}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
            <p className="text-xs text-slate-500 truncate">{email}</p>
          </div>
          <div className="p-1">
            <button
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
