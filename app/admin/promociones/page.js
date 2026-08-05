'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlinePhoto,
  HiOutlineXMark,
  HiOutlineCalendarDays,
} from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'
import { Confirm, useToast } from '@/components/Modal'

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyItem() {
  return { product_id: '', category_id: '', quantity: 1 }
}

function PromoForm({ promo, products, categories, onSave, onCancel, onError, onSuccess }) {
  const [form, setForm] = useState(() => ({
    title: promo?.title || '',
    description: promo?.description || '',
    type: promo?.type || 'combo',
    image: promo?.image || '',
    price: promo?.price ?? '',
    discount_type: promo?.discount_type || 'percent',
    discount_value: promo?.discount_value ?? '',
    min_quantity: promo?.min_quantity ?? 1,
    is_active: promo?.is_active ?? true,
    starts_at: toLocalInput(promo?.starts_at),
    ends_at: toLocalInput(promo?.ends_at),
    items: promo?.items?.length
      ? promo.items.map(i => ({ product_id: i.product_id || '', category_id: i.category_id || '', quantity: i.quantity || 1 }))
      : [emptyItem()],
  }))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const isCombo = form.type === 'combo'

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
      setForm({ ...form, image: url })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const setItem = (idx, patch) => {
    const items = form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    setForm({ ...form, items })
  }

  const setTarget = (value) => {
    setForm({ ...form, items: [{ product_id: value === 'product' ? form.items[0]?.product_id : '', category_id: value === 'category' ? form.items[0]?.category_id : '', quantity: form.items[0]?.quantity || 1 }] })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const token = localStorage.getItem('token')
    const items = isCombo
      ? form.items.filter(i => i.product_id).map(i => ({ product_id: i.product_id, quantity: parseInt(i.quantity) || 1 }))
      : form.items.map(i => ({
          product_id: i.product_id || null,
          category_id: i.category_id || null,
          quantity: parseInt(i.quantity) || 1,
        }))

    const body = {
      title: form.title,
      description: form.description,
      type: form.type,
      image: form.image || null,
      price: isCombo ? parseFloat(form.price) : null,
      discount_type: isCombo ? null : form.discount_type,
      discount_value: isCombo ? null : parseFloat(form.discount_value),
      min_quantity: isCombo ? 1 : parseInt(form.min_quantity) || 1,
      is_active: form.is_active,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      items,
    }

    try {
      const res = await fetch(
        promo ? `/api/promotions/${promo.id}` : '/api/promotions',
        {
          method: promo ? 'PATCH' : 'POST',
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

      onSuccess?.(promo ? 'Promoción actualizada correctamente' : 'Promoción creada correctamente')
      onSave()
    } catch (err) {
      onError?.(err.message)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
  const labelCls = "block text-xs uppercase tracking-widest text-white/40 mb-2"

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mb-6">
        <div>
          <label className={labelCls}>Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'combo' })}
              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                isCombo
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              Combo
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'promo' })}
              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                !isCombo
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              Promoción
            </button>
          </div>
          <p className="text-xs text-white/30 mt-2">
            {isCombo
              ? 'Varios productos juntos a un precio fijo (ej: matera + mate + termo).'
              : 'Descuento sobre un producto o categoría (ej: 2 yerbas con 15% OFF).'}
          </p>
        </div>

        <div>
          <label className={labelCls}>Foto</label>
          {form.image ? (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10 group">
              <img src={form.image} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setForm({ ...form, image: '' })}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <HiOutlineXMark size={16} />
              </button>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center gap-2 aspect-video rounded-xl border-2 border-dashed border-white/10 hover:border-primary/40 text-white/40 hover:text-primary-light cursor-pointer transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <HiOutlinePhoto size={22} />
              <span className="text-xs font-medium">{uploading ? 'Subiendo...' : 'Subir foto'}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {/* Info básica */}
      <div className="space-y-6 max-w-lg mb-6">
        <div>
          <label className={labelCls}>Título</label>
          <input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder={isCombo ? 'Combo Mate Completo' : '2 yerbas con 15% OFF'}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Descripción</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Lo que incluye o la oferta que se comunica al cliente"
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {/* Items y precio/descuento */}
      <div className="max-w-lg mb-6">
        <label className={labelCls}>
          {isCombo ? 'Productos que incluye' : 'Aplicar a'}
        </label>

        {isCombo ? (
          <div className="space-y-3">
            {form.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <select
                  value={item.product_id}
                  onChange={e => setItem(i, { product_id: e.target.value })}
                  className={`${inputCls} cursor-pointer flex-1`}
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="bg-graphite">{p.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => setItem(i, { quantity: e.target.value })}
                  className={`${inputCls} w-20 text-center`}
                  title="Cantidad"
                />
                {form.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}
                    className="p-3 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <HiOutlineTrash size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-dashed border-white/20 text-white/50 hover:text-white hover:border-primary/40 text-sm transition-all"
            >
              <HiOutlinePlus size={15} />
              Agregar producto
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <select
                value={form.items[0]?.product_id ? 'product' : 'category'}
                onChange={e => setTarget(e.target.value)}
                className={`${inputCls} sm:w-44 cursor-pointer`}
              >
                <option value="product">Producto</option>
                <option value="category">Categoría</option>
              </select>
              {form.items[0]?.product_id ? (
                <select
                  value={form.items[0]?.product_id || ''}
                  onChange={e => setItem(0, { product_id: e.target.value, category_id: '' })}
                  className={`${inputCls} cursor-pointer flex-1`}
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="bg-graphite">{p.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={form.items[0]?.category_id || ''}
                  onChange={e => setItem(0, { category_id: e.target.value, product_id: '' })}
                  className={`${inputCls} cursor-pointer flex-1`}
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id} className="bg-graphite">{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {!form.items[0]?.product_id && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">
                  Cantidad mínima para aplicar
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.min_quantity}
                  onChange={e => setForm({ ...form, min_quantity: e.target.value })}
                  className={`${inputCls} w-32`}
                />
                <p className="text-xs text-white/30 mt-2">
                  Ej: 2 = el cliente obtiene el descuento cuando lleva 2 o más productos de esa categoría.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <select
                value={form.discount_type}
                onChange={e => setForm({ ...form, discount_type: e.target.value })}
                className={`${inputCls} sm:w-44 cursor-pointer`}
              >
                <option value="percent">Porcentaje (%)</option>
                <option value="fixed">Monto fijo ($)</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount_value}
                onChange={e => setForm({ ...form, discount_value: e.target.value })}
                placeholder={form.discount_type === 'percent' ? '15' : '5000'}
                className={`${inputCls} flex-1`}
                required
              />
            </div>
          </div>
        )}

        {isCombo && (
          <div className="mt-4">
            <label className={labelCls}>Precio del combo ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })}
              placeholder="50000"
              className={`${inputCls} sm:max-w-xs`}
              required
            />
          </div>
        )}
      </div>

      {/* Vigencia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mb-6">
        <div>
          <label className={`${labelCls} flex items-center gap-1.5`}>
            <HiOutlineCalendarDays size={13} />
            Inicio
          </label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={e => setForm({ ...form, starts_at: e.target.value })}
            className={`${inputCls} cursor-pointer`}
          />
        </div>
        <div>
          <label className={`${labelCls} flex items-center gap-1.5`}>
            <HiOutlineCalendarDays size={13} />
            Fin
          </label>
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={e => setForm({ ...form, ends_at: e.target.value })}
            className={`${inputCls} cursor-pointer`}
          />
          <p className="text-xs text-white/30 mt-2">Sin fin = vigente hasta desactivarla.</p>
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm text-white/60 cursor-pointer select-none mb-8">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={e => setForm({ ...form, is_active: e.target.checked })}
          className="w-4 h-4 rounded accent-primary"
        />
        Promoción activa
      </label>

      <div className="flex flex-col sm:flex-row gap-3 pt-8 border-t border-white/10">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-all disabled:opacity-50"
        >
          {saving ? 'Guardando...' : promo ? 'Actualizar promoción' : 'Crear promoción'}
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

function promoToBody(p) {
  return {
    title: p.title,
    description: p.description,
    type: p.type,
    image: p.image,
    price: p.price,
    discount_type: p.discount_type,
    discount_value: p.discount_value,
    min_quantity: p.min_quantity || 1,
    is_active: !p.is_active,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    items: (p.items || []).map(i => ({
      product_id: i.product_id,
      category_id: i.category_id,
      quantity: i.quantity,
    })),
  }
}

export default function AdminPromociones() {
  const [promos, setPromos] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, promo: null })
  const router = useRouter()
  const { show: showToast } = useToast()

  const fetchPromos = () => {
    const token = localStorage.getItem('token')
    return fetch('/api/promotions', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(setPromos)
      .catch(() => {})
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/admin/login')
      return
    }

    fetchPromos()
    fetch('/api/products').then(res => res.json()).then(setProducts).catch(() => {})
    fetch('/api/categories').then(res => res.json()).then(setCategories).catch(() => {})
  }, [router])

  const handleDelete = (promo) => {
    setDeleteConfirm({ open: true, promo })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.promo) return
    const { promo } = deleteConfirm
    setDeleteConfirm({ open: false, promo: null })

    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`/api/promotions/${promo.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al eliminar')
      setPromos(promos.filter(p => p.id !== promo.id))
      showToast('Promoción eliminada correctamente', 'success')
    } catch (err) {
      showToast('Error al eliminar la promoción', 'error')
    }
  }

  const toggleActive = async (promo) => {
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`/api/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(promoToBody(promo)),
      })
      if (!res.ok) throw new Error('Error')
      await fetchPromos()
      showToast(promo.is_active ? 'Promoción desactivada' : 'Promoción activada', 'success')
    } catch (err) {
      showToast('Error al actualizar la promoción', 'error')
    }
  }

  const itemNames = (promo) => {
    if (!promo.items?.length) return '—'
    const labels = promo.items.map(i => {
      if (i.products) return `${i.quantity > 1 ? i.quantity + '× ' : ''}${i.products.name}`
      if (i.categories) return `${i.categories.name}${i.quantity > 1 ? ` (${i.quantity}+)` : ''}`
      return 'Producto'
    })
    return labels.join(', ')
  }

  const summary = (promo) => {
    if (promo.type === 'combo') {
      return `Precio combo: $${Number(promo.price).toLocaleString('es-AR')}`
    }
    if (promo.discount_type === 'percent') return `${promo.discount_value}% OFF`
    return `$${Number(promo.discount_value).toLocaleString('es-AR')} de descuento`
  }

  return (
    <AdminLayout title="Promociones">
      <div className="p-4 sm:p-8 lg:p-10">
        {showForm && (
          <div className="card-dark p-6 sm:p-8 mb-10">
            <h2 className="font-display font-semibold text-white text-lg mb-6">
              {editing ? 'Editar promoción' : 'Nueva promoción'}
            </h2>
            <PromoForm
              promo={editing}
              products={products}
              categories={categories}
              onSave={() => { fetchPromos(); setShowForm(false); setEditing(null) }}
              onCancel={() => { setShowForm(false); setEditing(null) }}
              onError={(msg) => showToast(msg, 'error')}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <p className="text-sm text-white/40">
            Combos y promociones que se muestran en la tienda.
          </p>
          <button
            onClick={() => { setShowForm(true); setEditing(null) }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all"
          >
            <HiOutlinePlus size={16} />
            Nueva promoción
          </button>
        </div>

        {promos.length === 0 ? (
          <div className="card-dark text-center py-24 px-6">
            <div className="text-6xl mb-4 opacity-20">🏷️</div>
            <p className="font-display text-xl text-white/60">Todavía no hay promociones</p>
            <p className="text-white/30 text-sm mt-3">
              Creá combos (matera + mate + termo) o promos con descuento (2 yerbas con 15% OFF).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {promos.map(promo => (
              <div key={promo.id} className="card-dark overflow-hidden flex flex-col">
                <div className="relative aspect-video bg-white/5 overflow-hidden">
                  {promo.image ? (
                    <img src={promo.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🏷️</div>
                  )}
                  <span className={`absolute top-3 left-3 badge ${promo.type === 'combo' ? 'badge-oferta' : 'badge-celeste'}`}>
                    {promo.type === 'combo' ? 'Combo' : 'Promoción'}
                  </span>
                  <span className={`absolute top-3 right-3 badge ${promo.is_active ? 'badge-stock' : 'badge-sinstock'}`}>
                    {promo.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <div className="flex-1 p-5 flex flex-col">
                  <h3 className="font-display font-semibold text-white text-lg leading-tight">{promo.title}</h3>
                  {promo.description && (
                    <p className="text-sm text-white/40 mt-1.5 line-clamp-2">{promo.description}</p>
                  )}
                  <p className="text-xs text-white/30 mt-3">{itemNames(promo)}</p>
                  <p className="text-primary-light font-semibold mt-1">{summary(promo)}</p>

                  <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-white/10">
                    <button
                      onClick={() => toggleActive(promo)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                        promo.is_active
                          ? 'border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/30'
                          : 'border-white/10 text-white/50 hover:text-primary-light hover:border-primary/40'
                      }`}
                    >
                      {promo.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditing(promo); setShowForm(true) }}
                        className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                        title="Editar"
                      >
                        <HiOutlinePencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(promo)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <HiOutlineTrash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Confirm
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, promo: null })}
        title="Eliminar promoción"
        message={`¿Estás seguro de que quieres eliminar "${deleteConfirm.promo?.title}"? Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="error"
      />
    </AdminLayout>
  )
}
