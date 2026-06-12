'use client'
import { addToCart, removeFromCart } from "@/lib/features/cart/cartSlice";
import { syncCart } from "@/lib/syncCart";
import { useDispatch, useSelector } from "react-redux";

const Counter = ({ productId }) => {

    const { cartItems } = useSelector(state => state.cart);

    const dispatch = useDispatch();

    const addToCartHandler = () => {
        dispatch(addToCart({ productId }))
        const updatedCart = { ...cartItems, [productId]: (cartItems[productId] ?? 0) + 1 }
        syncCart(updatedCart)
    }

    const removeFromCartHandler = () => {
        dispatch(removeFromCart({ productId }))
        const currentQty = cartItems[productId] ?? 0
        const updatedCart = { ...cartItems }
        if (currentQty <= 1) {
            delete updatedCart[productId]
        } else {
            updatedCart[productId] = currentQty - 1
        }
        syncCart(updatedCart)
    }

    return (
        <div className="inline-flex items-center gap-1 sm:gap-3 px-3 py-1 rounded border border-slate-200 max-sm:text-sm text-slate-600">
            <button onClick={removeFromCartHandler} className="p-1 select-none">-</button>
            <p className="p-1">{cartItems[productId]}</p>
            <button onClick={addToCartHandler} className="p-1 select-none">+</button>
        </div>
    )
}

export default Counter