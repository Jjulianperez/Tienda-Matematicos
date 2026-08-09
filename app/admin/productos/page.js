'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineXMark, HiOutlinePhoto, HiOutlineCog6Tooth, HiOutlineInformationCircle } from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'
import { Confirm, useToast } from '@/components/Modal'
import FormModal from '@/components/admin/FormModal'
import LoadingModal from '@/components/ui/LoadingModal'
import { Field, TextInput, TextArea, Select, Toggle, Tabs, SectionCard, FormActions, inputCls } from '@/components/admin/fields'

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

  return (
    <FormModal
      open
      onClose={onCancel}
      title={product ? 'Editar producto' : 'Nuevo producto'}
      subtitle={product ? `Editando: ${product.name}` : 'Cargá un producto para la tienda'}
      footer={
        <FormActions
          formId="product-form"
          onCancel={onCancel}
          saving={saving}
          submitText={product ? 'Actualizar producto' : 'Crear producto'}
        />
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-6 px-6 sm:px-8 py-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {tab === 'info' && (
          <SectionCard title="Información básica" description="Nombre, descripción y categoría">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <TextInput
                  label="Nombre"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Mate imperial calabaza"
                />
              </div>
              <div className="sm:col-span-2">
                <TextArea
                  label="Descripción"
                  rows={4}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Select
                  label="Categoría"
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-graphite">{cat.name}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Toggle
                  label="Producto destacado"
                  hint={form.featured ? 'Se prioriza en el catálogo' : 'Aparece con el resto de los productos'}
                  checked={form.featured}
                  onChange={v => setForm({ ...form, featured: v })}
                />
              </div>
            </div>
          </SectionCard>
        )}

        {tab === 'images' && (
          <SectionCard
            title="Imágenes del producto"
            description="La primera imagen es la portada en la tienda"
            icon={HiOutlinePhoto}
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {form.images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1.5 right-1.5 p-2 rounded-lg bg-black/85 text-white hover:bg-black border border-white/20 shadow-md transition-colors"
                    aria-label={`Quitar imagen ${i + 1}`}
                  >
                    <HiOutlineXMark size={16} />
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
          </SectionCard>
        )}

        {tab === 'stock' && (
          <SectionCard title="Inventario" description="Precio y stock disponible" icon={HiOutlineCog6Tooth}>
            <div className="grid sm:grid-cols-2 gap-6">
              <Field label="Precio ($)" required>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  className={`${inputCls} text-lg font-display font-semibold`}
                  required
                />
              </Field>
              <Field label="Stock" hint={parseInt(form.stock) === 0 ? 'Se mostrará como "Sin stock" en la tienda.' : undefined}>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={e => setForm({ ...form, stock: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          </SectionCard>
        )}
      </form>
    </FormModal>
  )
}

export default function AdminProductos() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, product: null })
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { show: showToast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/admin/login')
      return
    }

    const loadData = async () => {
      setLoading(true)
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories')
        ])
        const [productsData, categoriesData] = await Promise.all([
          productsRes.json(),
          categoriesRes.json()
        ])
        setProducts(productsData)
        setCategories(categoriesData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
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
      <LoadingModal open={loading} message="Cargando productos y categorías..." />
      <div className="p-4 sm:p-8 lg:p-10">
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

      {showForm && (
        <ProductForm
          product={editing}
          categories={categories}
          onSave={refreshProducts}
          onCancel={() => { setShowForm(false); setEditing(null) }}
          onError={(msg) => showToast(msg, 'error')}
          onSuccess={(msg) => showToast(msg, 'success')}
        />
      )}

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
