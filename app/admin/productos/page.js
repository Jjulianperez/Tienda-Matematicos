'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineArrowLeft } from 'react-icons/hi2'
import Link from 'next/link'

function ProductForm({ product, categories, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    stock: product?.stock ?? '',
    category_id: product?.category_id || '',
    images: product?.images?.join('\n') || '',
    featured: product?.featured || false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const token = localStorage.getItem('token')
    const body = {
      ...form,
      price: parseFloat(form.price),
      stock: parseInt(form.stock) || 0,
      images: form.images.split('\n').filter(Boolean),
    }

    try {
      const res = await fetch(
        product ? `/api/products/${product.id}` : '/api/products',
        {
          method: product ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }

      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm text-white/60 mb-1">Nombre</label>
        <input
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Descripción</label>
        <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/60 mb-1">Precio ($)</label>
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">Stock</label>
          <input
            type="number"
            value={form.stock}
            onChange={e => setForm({ ...form, stock: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Categoría</label>
        <select
          value={form.category_id}
          onChange={e => setForm({ ...form, category_id: e.target.value })}
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
        >
          <option value="">Sin categoría</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Imágenes (una URL por línea)</label>
        <textarea
          value={form.images}
          onChange={e => setForm({ ...form, images: e.target.value })}
          rows={3}
          placeholder="https://res.cloudinary.com/..."
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-primary transition-colors resize-none"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-white/60">
        <input
          type="checkbox"
          checked={form.featured}
          onChange={e => setForm({ ...form, featured: e.target.checked })}
          className="rounded"
        />
        Producto destacado
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-all disabled:opacity-50"
        >
          {saving ? 'Guardando...' : product ? 'Actualizar' : 'Crear producto'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function AdminProductos() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/admin/login')
      return
    }

    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts)
      .catch(() => {})

    fetch('/api/categories')
      .then(res => res.json())
      .then(setCategories)
      .catch(() => {})
  }, [router])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    const token = localStorage.getItem('token')
    await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setProducts(products.filter(p => p.id !== id))
  }

  const refreshProducts = () => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts)
      .catch(() => {})
    setShowForm(false)
    setEditing(null)
  }

  return (
    <div className="min-h-screen bg-carbon">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-white/40 hover:text-white transition-colors">
            <HiOutlineArrowLeft size={20} />
          </Link>
          <span className="text-xl">🧉</span>
          <h1 className="text-white font-semibold">Productos</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all"
        >
          <HiOutlinePlus size={16} />
          Nuevo
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {showForm && (
          <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-medium text-white mb-4">
              {editing ? 'Editar producto' : 'Nuevo producto'}
            </h2>
            <ProductForm
              product={editing}
              categories={categories}
              onSave={refreshProducts}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-left">
                <th className="pb-3 font-medium">Producto</th>
                <th className="pb-3 font-medium">Precio</th>
                <th className="pb-3 font-medium">Stock</th>
                <th className="pb-3 font-medium">Clics</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b border-white/5 text-white">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] && (
                        <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover bg-white/5" />
                      )}
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-primary">${Number(product.price).toLocaleString('es-AR')}</td>
                  <td className="py-3">{product.stock}</td>
                  <td className="py-3 text-white/40">{product.whatsapp_clicks}</td>
                  <td className="py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setEditing(product); setShowForm(true) }}
                        className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                      >
                        <HiOutlinePencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                      >
                        <HiOutlineTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {products.length === 0 && (
            <div className="text-center py-20 text-white/40">
              No hay productos todavía. Creá el primero.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
