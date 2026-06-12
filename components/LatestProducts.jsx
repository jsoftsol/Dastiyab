'use client'
import React, { useEffect, useState } from 'react'
import Title from './Title'
import ProductCard from './ProductCard'

const LatestProducts = () => {

    const displayQuantity = 4
    const [products, setProducts] = useState([])

    useEffect(() => {
        fetch('/api/public/products?limit=4&sort=createdAt')
            .then(r => r.json())
            .then(data => setProducts(data.products ?? []))
            .catch(() => {})
    }, [])

    return (
        <div className='px-6 my-30 max-w-6xl mx-auto'>
            <Title title='Latest Products' description={`Showing ${products.length < displayQuantity ? products.length : displayQuantity} of ${products.length} products`} href='/shop' />
            <div className='mt-12 grid grid-cols-2 sm:flex flex-wrap gap-6 justify-between'>
                {products.slice(0, displayQuantity).map((product, index) => (
                    <ProductCard key={index} product={product} />
                ))}
            </div>
        </div>
    )
}

export default LatestProducts