'use client'
import { assets } from '@/assets/assets'
import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import Loading from '@/components/Loading'

export default function CreateStore() {
  const { data: session } = useSession()
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [storeInfo, setStoreInfo] = useState({
    name: '',
    username: '',
    description: '',
    email: '',
    contact: '',
    address: '',
    image: '',
  })

  const onChangeHandler = (e) => {
    setStoreInfo({ ...storeInfo, [e.target.name]: e.target.value })
  }

  const fetchSellerStatus = async () => {
    const res = await fetch('/api/customer/store')
    if (res.ok) {
      const data = await res.json()
      if (data.store) {
        setAlreadySubmitted(true)
        const isApproved = data.store.status === 'approved'
        setStatus(isApproved ? 'approved' : 'pending')
        setMessage(
          isApproved
            ? 'Your store is approved and active!'
            : "Your store is under review. We'll notify you once approved."
        )
        if (isApproved) {
          setTimeout(() => { window.location.href = '/store' }, 5000)
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    if (session) fetchSellerStatus()
    else setLoading(false)
  }, [session])

  const onSubmitHandler = async (e) => {
    e.preventDefault()

    let imageUrl = ''
    if (storeInfo.image) {
      const formData = new FormData()
      formData.append('image', storeInfo.image)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) { toast.error('Image upload failed'); return }
      const uploadData = await uploadRes.json()
      imageUrl = uploadData.url
    }

    const res = await fetch('/api/public/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: storeInfo.name,
        username: storeInfo.username,
        description: storeInfo.description,
        email: storeInfo.email,
        contact: storeInfo.contact,
        address: storeInfo.address,
        logo: imageUrl,
      }),
    })

    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Submission failed'); return }

    toast.success('Store submitted! Sign in again to continue.')
    await signOut({ callbackUrl: '/sign-in' })
  }

  return !loading ? (
    <>
      {!alreadySubmitted ? (
        <div className="mx-6 min-h-[70vh] my-16">
          <form
            onSubmit={e => toast.promise(onSubmitHandler(e), { loading: 'Submitting data...' })}
            className="max-w-7xl mx-auto flex flex-col items-start gap-3 text-slate-500"
          >
            <div>
              <h1 className="text-3xl">Add Your <span className="text-slate-800 font-medium">Store</span></h1>
              <p className="max-w-lg">To become a seller on Dastiyab, submit your store details for review. Your store will be activated after admin verification.</p>
            </div>

            <label className="mt-10 cursor-pointer">
              Store Logo
              <Image
                src={storeInfo.image ? URL.createObjectURL(storeInfo.image) : assets.upload_area}
                className="rounded-lg mt-2 h-16 w-auto"
                alt=""
                width={150}
                height={100}
              />
              <input type="file" accept="image/*" onChange={(e) => setStoreInfo({ ...storeInfo, image: e.target.files[0] })} hidden />
            </label>

            <p>Username</p>
            <input name="username" onChange={onChangeHandler} value={storeInfo.username} type="text" placeholder="Enter your store username" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded" />

            <p>Name</p>
            <input name="name" onChange={onChangeHandler} value={storeInfo.name} type="text" placeholder="Enter your store name" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded" />

            <p>Description</p>
            <textarea name="description" onChange={onChangeHandler} value={storeInfo.description} rows={5} placeholder="Enter your store description" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded resize-none" />

            <p>Email</p>
            <input name="email" onChange={onChangeHandler} value={storeInfo.email} type="email" placeholder="Enter your store email" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded" />

            <p>Contact Number</p>
            <input name="contact" onChange={onChangeHandler} value={storeInfo.contact} type="text" placeholder="Enter your store contact number" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded" />

            <p>Address</p>
            <textarea name="address" onChange={onChangeHandler} value={storeInfo.address} rows={5} placeholder="Enter your store address" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded resize-none" />

            <button className="bg-slate-800 text-white px-12 py-2 rounded mt-10 mb-40 active:scale-95 hover:bg-slate-900 transition">Submit</button>
          </form>
        </div>
      ) : (
        <div className="min-h-[80vh] flex flex-col items-center justify-center">
          <p className="sm:text-2xl lg:text-3xl mx-5 font-semibold text-slate-500 text-center max-w-2xl">{message}</p>
          {status === 'approved' && <p className="mt-5 text-slate-400">redirecting to dashboard in <span className="font-semibold">5 seconds</span></p>}
        </div>
      )}
    </>
  ) : (<Loading />)
}
