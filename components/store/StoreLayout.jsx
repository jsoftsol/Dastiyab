import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import SellerNavbar from './StoreNavbar'
import SellerSidebar from './StoreSidebar'

const StoreLayout = async ({ children }) => {
  const { userId } = await getAuthUser()
  if (!userId) redirect('/sign-in')

  const store = await prisma.store.findUnique({ where: { userId } })

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-2xl sm:text-4xl font-semibold text-slate-400">
          You are not authorized to access this page
        </h1>
        <Link
          href="/"
          className="bg-slate-700 text-white flex items-center gap-2 mt-8 p-2 px-6 max-sm:text-sm rounded-full"
        >
          Go to home <ArrowRightIcon size={18} />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <SellerNavbar />
      <div className="flex flex-1 items-start h-full overflow-y-scroll no-scrollbar">
        <SellerSidebar storeInfo={{ name: store.name, logo: store.logo }} />
        <div className="flex-1 h-full p-5 lg:pl-12 lg:pt-12 overflow-y-scroll">
          {children}
        </div>
      </div>
    </div>
  )
}

export default StoreLayout