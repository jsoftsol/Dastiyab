import StoreLayout from "@/components/store/StoreLayout";

export const metadata = {
    title: "Dastiyab. - Store Dashboard",
    description: "Dastiyab. - Store Dashboard",
};

export default function RootAdminLayout({ children }) {

    return (
        <>
            <StoreLayout>
                {children}
            </StoreLayout>
        </>
    );
}
