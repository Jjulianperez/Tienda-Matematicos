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
  HiOutlineInformationCircle,
  HiOutlineCube,
  HiOutlineShoppingBag,
} from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'
import { Confirm, useToast } from '@/components/Modal'
import FormModal from '@/components/admin/FormModal'
import {
  Field,
  TextInput,
  TextArea,
  Select,
  Toggle,
  Tabs,
  SectionCard,
  FormActions,
  inputCls,
} from '@/components/admin/fields'
import ProductSelect from '@/components/admin/ProductSelect'
import { computeSalePrice } from '@/lib/pricing'

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyItem() {
  return { product_id: '', category_id: '', quantity: 1 }
}

function TypeOption({ active, onClick, icon: Icon, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-all ${
        active
          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
          : 'border-white/10 bg-white/5 hover:border-white/25'
      }`}
    >
      <Icon size={20} className={`mb-2.5 ${active ? 'text-primary-light' : 'text-white/40'}`} />
      <span className="block text-white font-semibold text-sm">{title}</span>
      <span className="block text-[10px] text-white/40 mt-1 leading-relaxed">{desc}</span>
    </button>
  )
}

function PromoForm({ promo, products, categories, onSave, onCancel, onError, onSuccess }) {
  const [tab, setTab] = useState('info')
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

  const changeType = (type) => {
    setForm({ ...form, type, items: [emptyItem()] })
  }

  const setTarget = (value) => {
    setForm({
      ...form,
      items: [{
        product_id: value === 'product' ? form.items[0]?.product_id : '',
        category_id: value === 'category' ? form.items[0]?.category_id : '',
        quantity: form.items[0]?.quantity || 1,
      }],
    })
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

    if (!items.length) {
      setError(isCombo ? 'Agregá al menos un producto al combo' : 'Elegí un producto o categoría')
      setSaving(false)
      return
    }

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
      setTab('info')
    } finally {
      setSaving(false)
    }
  }

  const selectedProducts = form.items
    .map(it => {
      const p = products.find(x => x.id === it.product_id)
      return p ? { ...p, qty: parseInt(it.quantity) || 1 } : null
    })
    .filter(Boolean)

  const comboTotal = selectedProducts.reduce((sum, p) => sum + Number(p.price) * p.qty, 0)
  const comboPrice = parseFloat(form.price)
  const savings = comboPrice > 0 && comboTotal > comboPrice ? comboTotal - comboPrice : 0

  const productTarget = products.find(p => p.id === form.items[0]?.product_id)
  const previewPrice = productTarget
    ? computeSalePrice(Number(productTarget.price), form.discount_type, parseFloat(form.discount_value))
    : null

  const excludedIds = form.items.filter(i => i.product_id).map(i => i.product_id)

  const tabs = [
    { id: 'info', label: 'Información', icon: HiOutlineInformationCircle },
    { id: 'contenido', label: isCombo ? 'Productos' : 'Oferta', icon: isCombo ? HiOutlineCube : HiOutlineShoppingBag },
    { id: 'vigencia', label: 'Vigencia', icon: HiOutlineCalendarDays },
  ]

  return (
    <FormModal
      open
      onClose={onCancel}
      title={promo ? 'Editar promoción' : 'Nueva promoción'}
      subtitle={
        isCombo
          ? 'Varios productos juntos a un precio fijo'
          : 'Descuento por producto o categoría'
      }
      footer={
        <FormActions
          formId="promo-form"
          onCancel={onCancel}
          saving={saving}
          submitText={promo ? 'Actualizar promoción' : 'Crear promoción'}
        />
      }
    >
      <form id="promo-form" onSubmit={handleSubmit} className="space-y-6 px-6 sm:px-8 py-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {tab === 'info' && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <SectionCard title="Tipo de promoción" description="¿Qué querés crear?">
                <div className="grid grid-cols-2 gap-3">
                  <TypeOption
                    active={isCombo}
                    onClick={() => changeType('combo')}
                    icon={HiOutlineCube}
                    title="Combo"
                    desc="Productos a precio fijo"
                  />
                  <TypeOption
                    active={!isCombo}
                    onClick={() => changeType('promo')}
                    icon={HiOutlineShoppingBag}
                    title="Promoción"
                    desc="Descuento por cantidad"
                  />
                </div>
              </SectionCard>

              <SectionCard title="Foto" description="Se muestra en catálogo y home">
                {form.image ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10">
                    <img src={form.image} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image: '' })}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-black/85 text-white hover:bg-black border border-white/20 shadow-md transition-colors"
                      aria-label="Quitar imagen"
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
              </SectionCard>
            </div>

            <SectionCard title="Datos básicos">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <TextInput
                    label="Título"
                    required
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder={isCombo ? 'Combo Mate Completo' : '2 yerbas con 15% OFF'}
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextArea
                    label="Descripción"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Lo que incluye o la oferta que se comunica al cliente"
                  />
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {tab === 'contenido' && (
          <div className="space-y-6">
            {isCombo ? (
              <>
                <SectionCard
                  title="Productos que incluye"
                  description="Elegí los productos del combo y sus cantidades"
                  icon={HiOutlineCube}
                >
                  <div className="space-y-3">
                    {form.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <ProductSelect
                            products={products}
                            value={item.product_id}
                            onChange={id => setItem(i, { product_id: id })}
                            excludeIds={excludedIds.filter(id => id !== item.product_id)}
                          />
                        </div>
                        <div className="w-24 shrink-0">
                          <Field label="Cant.">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => setItem(i, { quantity: e.target.value })}
                              className={`${inputCls} text-center`}
                            />
                          </Field>
                        </div>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}
                            className="self-end p-3 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors mb-0.5"
                            aria-label="Quitar producto"
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
                </SectionCard>

                <SectionCard title="Precio del combo" description="Precio final que paga el cliente" icon={HiOutlineShoppingBag}>
                  <div className="grid sm:grid-cols-2 gap-6 items-start">
                    <Field label="Precio ($)" required>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.price}
                        onChange={e => setForm({ ...form, price: e.target.value })}
                        placeholder="50000"
                        className={`${inputCls} text-lg font-display font-semibold`}
                        required
                      />
                    </Field>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Suma de productos</span>
                        <span className="text-white/70">${comboTotal.toLocaleString('es-AR')}</span>
                      </div>
                      {savings > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-white/40">Ahorro del cliente</span>
                          <span className="text-primary-light font-semibold">${savings.toLocaleString('es-AR')}</span>
                        </div>
                      )}
                      {comboPrice > 0 && comboTotal > 0 && comboPrice >= comboTotal && (
                        <p className="text-[10px] text-amber-400/80 pt-1 border-t border-white/10">
                          El precio no es menor a la suma de productos: no se ve como oferta.
                        </p>
                      )}
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : (
              <>
                <SectionCard title="Aplicar la oferta a" description="Elegí sobre qué productos rige el descuento" icon={HiOutlineShoppingBag}>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="grid grid-cols-2 gap-2 sm:w-64 shrink-0">
                        <button
                          type="button"
                          onClick={() => setTarget('product')}
                          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            form.items[0]?.product_id
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          Producto
                        </button>
                        <button
                          type="button"
                          onClick={() => setTarget('category')}
                          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            !form.items[0]?.product_id
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          Categoría
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        {form.items[0]?.product_id ? (
                          <ProductSelect
                            products={products}
                            value={form.items[0]?.product_id || ''}
                            onChange={id => setItem(0, { product_id: id, category_id: '' })}
                          />
                        ) : (
                          <Select
                            value={form.items[0]?.category_id || ''}
                            onChange={e => setItem(0, { category_id: e.target.value, product_id: '' })}
                          >
                            <option value="">Seleccionar categoría...</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id} className="bg-graphite">{c.name}</option>
                            ))}
                          </Select>
                        )}
                      </div>
                    </div>

                    {!form.items[0]?.product_id && (
                      <Field
                        label="Cantidad mínima para aplicar"
                        hint="Ej: 2 = el cliente obtiene el descuento cuando lleva 2 o más productos de esa categoría."
                      >
                        <input
                          type="number"
                          min="1"
                          value={form.min_quantity}
                          onChange={e => setForm({ ...form, min_quantity: e.target.value })}
                          className={`${inputCls} max-w-xs`}
                        />
                      </Field>
                    )}
                  </div>
                </SectionCard>

                <SectionCard title="Descuento" description="Cuánto baja el precio por unidad" icon={HiOutlineInformationCircle}>
                  <div className="grid sm:grid-cols-2 gap-6 items-start">
                    <Select
                      label="Tipo"
                      value={form.discount_type}
                      onChange={e => setForm({ ...form, discount_type: e.target.value })}
                    >
                      <option value="percent">Porcentaje (%)</option>
                      <option value="fixed">Monto fijo ($)</option>
                    </Select>
                    <Field label={form.discount_type === 'percent' ? 'Descuento (%)' : 'Descuento ($)'} required>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.discount_value}
                        onChange={e => setForm({ ...form, discount_value: e.target.value })}
                        placeholder={form.discount_type === 'percent' ? '15' : '5000'}
                        className={inputCls}
                        required
                      />
                    </Field>
                    {previewPrice !== null && (
                      <div className="sm:col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm">
                        <span className="text-white/40">El cliente pagará </span>
                        <span className="text-primary-light font-semibold">${previewPrice.toLocaleString('es-AR')}</span>
                        <span className="text-white/40"> por unidad de </span>
                        <span className="text-white">{productTarget?.name}</span>
                      </div>
                    )}
                  </div>
                </SectionCard>
              </>
            )}
          </div>
        )}

        {tab === 'vigencia' && (
          <div className="space-y-6">
            <SectionCard title="Vigencia" description="Período en el que la oferta está activa en la tienda" icon={HiOutlineCalendarDays}>
              <div className="grid sm:grid-cols-2 gap-6">
                <Field label="Inicio">
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={e => setForm({ ...form, starts_at: e.target.value })}
                    className={`${inputCls} cursor-pointer`}
                  />
                </Field>
                <Field label="Fin" hint="Sin fin = vigente hasta desactivarla.">
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={e => setForm({ ...form, ends_at: e.target.value })}
                    className={`${inputCls} cursor-pointer`}
                  />
                </Field>
              </div>
              <div className="mt-6">
                <Toggle
                  label="Promoción activa"
                  hint={form.is_active ? 'Visible en la tienda' : 'Oculta para los clientes'}
                  checked={form.is_active}
                  onChange={v => setForm({ ...form, is_active: v })}
                />
              </div>
            </SectionCard>
          </div>
        )}
      </form>
    </FormModal>
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
      .then(data => { if (Array.isArray(data)) setPromos(data) })
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

      {showForm && (
        <PromoForm
          promo={editing}
          products={products}
          categories={categories}
          onSave={() => { fetchPromos(); setShowForm(false); setEditing(null) }}
          onCancel={() => { setShowForm(false); setEditing(null) }}
          onError={(msg) => showToast(msg, 'error')}
          onSuccess={(msg) => showToast(msg, 'success')}
        />
      )}

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
