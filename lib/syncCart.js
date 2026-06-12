export function syncCart(cartItems) {
  fetch('/api/customer/cart', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart: cartItems }),
  }).catch(() => {})
}
