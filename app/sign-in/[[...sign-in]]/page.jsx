'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SignInPage() {
  const [tab, setTab] = useState('signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignIn(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.target)
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Invalid email or password')
      return
    }
    const res = await fetch('/api/auth/session')
    const session = await res.json()
    const role = session?.user?.role
    if (role === 'admin') router.push('/admin')
    else if (role === 'vendor') router.push('/store')
    else router.push('/')
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.target)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setLoading(false)
      setError(data.error || 'Registration failed')
      return
    }
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Account created — please sign in')
      setTab('signin')
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-3xl font-semibold text-slate-700 mb-6 text-center">
          <span className="text-green-600">go</span>cart<span className="text-green-600 text-4xl leading-0">.</span>
        </h1>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => { setTab('signin'); setError('') }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              tab === 'signin'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError('') }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              tab === 'signup'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {tab === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                name="password"
                type="password"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                name="name"
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <div className="mt-4 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs text-slate-400">
            <span className="bg-white px-2">or continue with</span>
          </div>
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="mt-4 w-full flex items-center justify-center gap-2 border border-slate-300 hover:border-slate-400 bg-white py-2 rounded-lg text-sm font-medium text-slate-700 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
