import AdminLayout from "@/components/admin/AdminLayout";

export const metadata = {
    title: "Dastiyab. - Admin",
    description: "Dastiyab. - Admin",
};

export default function RootAdminLayout({ children }) {

    return (
        <>
            <AdminLayout>
                {children}
            </AdminLayout>
        </>
    );
}
