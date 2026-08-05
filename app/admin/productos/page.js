'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineXMark, HiOutlinePhoto, HiOutlineCog6Tooth, HiOutlineInformationCircle } from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'
import { Alert, Confirm, useToast } from '@/components/Modal'

function ProductForm({ product, categories, onSave, onCancel, onError, onSuccess }) {
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    stock: product?.stock ?? '',
    category_id: product?.category_id || '',
    images: product?.images || [],
    featured: product?.featured || false,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) throw new Error('Error al subir imagen')

      const { url } = await res.json()
      setForm({ ...form, images: [...form.images, url] })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = (idx) => {
    setForm({ ...form, images: form.images.filter((_, i) => i !== idx) })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const token = localStorage.getItem('token')
    const body = {
      ...form,
      price: parseFloat(form.price),
      stock: parseInt(form.stock) || 0,
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

      onSuccess?.(product ? 'Producto actualizado correctamente' : 'Producto creado correctamente')
      onSave()
    } catch (err) {
      onError?.(err.message)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'info', label: 'Información', icon: HiOutlineInformationCircle },
    { id: 'images', label: 'Imágenes', icon: HiOutlinePhoto },
    { id: 'stock', label: 'Inventario', icon: HiOutlineCog6Tooth },
  ]

  const inputCls = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
  const labelCls = "block text-xs uppercase tracking-widest text-white/40 mb-2"

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="flex gap-1 border-b border-white/10 mb-8 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'text-primary-light border-primary'
                : 'text-white/40 border-transparent hover:text-white'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-6 max-w-lg">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className={labelCls}>Categoría</label>
            <select
              value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Sin categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-graphite">{cat.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={e => setForm({ ...form, featured: e.target.checked })}
              className="w-4 h-4 rounded accent-primary"
            />
            Producto destacado
            <span className="badge badge-premium ml-1">Premium</span>
          </label>
        </div>
      )}

      {tab === 'images' && (
        <div className="max-w-lg">
          <label className={labelCls}>Imágenes del producto</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
            {form.images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 group">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <HiOutlineXMark size={14} />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 badge badge-geo">Principal</span>
                )}
              </div>
            ))}
            <label className={`flex flex-col items-center justify-center gap-2 aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-primary/40 text-white/40 hover:text-primary-light cursor-pointer transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <HiOutlinePlus size={22} />
              <span className="text-xs font-medium">{uploading ? 'Subiendo...' : 'Agregar'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-white/30">
            La primera imagen es la portada del producto en la tienda.
          </p>
        </div>
      )}

      {tab === 'stock' && (
        <div className="grid grid-cols-2 gap-6 max-w-lg">
          <div>
            <label className={labelCls}>Precio ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Stock</label>
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={e => setForm({ ...form, stock: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            {parseInt(form.stock) === 0 && (
              <p className="text-sm text-red-400/80">
                Este producto se mostrará como &ldquo;Sin stock&rdquo; en la tienda.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-8 border-t border-white/10 mt-8">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-all disabled:opacity-50"
        >
          {saving ? 'Guardando...' : product ? 'Actualizar producto' : 'Crear producto'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center px-7 py-3 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
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
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, product: null })
  const router = useRouter()
  const { show: showToast } = useToast()

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

  const handleDelete = (product) => {
    setDeleteConfirm({ open: true, product })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.product) return
    const { product } = deleteConfirm
    setDeleteConfirm({ open: false, product: null })
    
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al eliminar')
      setProducts(products.filter(p => p.id !== product.id))
      showToast('Producto eliminado correctamente', 'success')
    } catch (err) {
      showToast('Error al eliminar el producto', 'error')
    }
  }

  const refreshProducts = (successMessage) => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts)
      .catch(() => {})
    setShowForm(false)
    setEditing(null)
    if (successMessage) showToast(successMessage, 'success')
  }

  const filtered = search.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.categories?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : products

  return (
    <AdminLayout title="Productos">
      <div className="p-4 sm:p-8 lg:p-10">
        {showForm && (
          <div className="card-dark p-6 sm:p-8 mb-10">
            <h2 className="font-display font-semibold text-white text-lg mb-6">
              {editing ? 'Editar producto' : 'Nuevo producto'}
            </h2>
            <ProductForm
              product={editing}
              categories={categories}
              onSave={refreshProducts}
              onCancel={() => { setShowForm(false); setEditing(null) }}
              onError={(msg) => showToast(msg, 'error')}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar productos..."
            className="input-dark sm:max-w-xs"
          />
          <button
            onClick={() => { setShowForm(true); setEditing(null) }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all"
          >
            <HiOutlinePlus size={16} />
            Nuevo producto
          </button>
        </div>

        <div className="card-dark overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-4 opacity-20">🧉</div>
              <p className="text-white/40">No hay productos todavía. Creá el primero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-admin">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Clics</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover bg-white/5"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-lg opacity-30">🧉</div>
                          )}
                          <div>
                            <p className="text-white font-medium">{product.name}</p>
                            <p className="text-xs text-white/30">{product.categories?.name || 'Sin categoría'}</p>
                          </div>
                          {product.featured && (
                            <span className="badge badge-premium ml-1">Premium</span>
                          )}
                        </div>
                      </td>
                      <td className="text-primary-light font-medium">
                        ${Number(product.price).toLocaleString('es-AR')}
                      </td>
                      <td>
                        {product.stock === 0 ? (
                          <span className="badge badge-sinstock">Sin stock</span>
                        ) : product.stock <= 5 ? (
                          <span className="badge badge-artesanal">{product.stock} · bajo</span>
                        ) : (
                          <span className="badge badge-stock">{product.stock}</span>
                        )}
                      </td>
                      <td className="text-white/40">{product.whatsapp_clicks}</td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => { setEditing(product); setShowForm(true) }}
                            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                            title="Editar"
                          >
                            <HiOutlinePencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                            title="Eliminar"
                          >
                            <HiOutlineTrash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Confirm
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, product: null })}
        title="Eliminar producto"
        message={`¿Estás seguro de que quieres eliminar "${deleteConfirm.product?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="error"
      />
    </AdminLayout>
  )
}