'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineMagnifyingGlass,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineShoppingBag,
  HiOutlineArrowPath,
  HiOutlineUsers,
} from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'
import FormModal from '@/components/admin/FormModal'
import { Confirm, useToast, ToastStack } from '@/components/Modal'
import LoadingModal from '@/components/ui/LoadingModal'
import { TextInput, TextArea, Select, FormActions } from '@/components/admin/fields'
import { formatMoney, formatDate, formatRelative, formatDateTime } from '@/lib/format'

// `order` es implícito: la API aplica el orden natural de cada criterio
// (fecha y monto descendente, nombre ascendente). Mandarlo siempre haría que
// "Nombre" arrancara al revés.
const SORT_OPTIONS = [
  { value: 'last_order_at', label: 'Última compra' },
  { value: 'total_spent', label: 'Total gastado' },
  { value: 'name', label: 'Nombre' },
  { value: 'created_at', label: 'Fecha de alta' },
]

const STATUS = {
  pending: { label: 'Pendiente', cls: 'badge-celeste' },
  confirmed: { label: 'Confirmada', cls: 'badge-stock' },
  cancelled: { label: 'Cancelada', cls: 'badge-sinstock' },
}

const PER_PAGE = 25

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  }
}

// ---------------------------------------------------------------------------
// Alta / edición
// ---------------------------------------------------------------------------
function CustomerForm({ customer, onSaved, onCancel, onError }) {
  const isEdit = Boolean(customer)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: customer?.name || '',
    // Se muestra el teléfono ya formateado para que sea legible. Al guardar,
    // la API lo vuelve a normalizar, así que no importa el formato que quede.
    phone: customer?.phone_display || customer?.phone || '',
    email: customer?.email || '',
    tags: (customer?.tags || []).join(', '),
    notes: customer?.notes || '',
  })

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        notes: form.notes,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }
      // El teléfono es la identidad del cliente y no se puede editar: si se
      // cambiara, podría chocar con otro cliente o dejar huérfanas sus órdenes.
      if (!isEdit) payload.phone = form.phone

      const res = await fetch(isEdit ? `/api/customers/${customer.id}` : '/api/customers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el cliente')

      onSaved(isEdit ? 'Cliente actualizado' : 'Cliente creado')
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      onClose={onCancel}
      title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
      subtitle={isEdit ? customer.phone_display || customer.phone : 'Cargá los datos a mano'}
      footer={
        <FormActions
          formId="customer-form"
          onCancel={onCancel}
          saving={saving}
          submitText={isEdit ? 'Guardar cambios' : 'Crear cliente'}
        />
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-5 px-6 sm:px-8 py-6">
        <TextInput
          label="Nombre"
          value={form.name}
          onChange={set('name')}
          placeholder="Juan Pérez"
        />

        <TextInput
          label="Teléfono"
          required={!isEdit}
          value={form.phone}
          onChange={set('phone')}
          disabled={isEdit}
          hint={
            isEdit
              ? 'El teléfono identifica al cliente y no se puede cambiar.'
              : 'Acepta cualquier formato: 11 5555-4444, +54 9 11 5555 4444, etc.'
          }
          placeholder="11 5555-4444"
        />

        <TextInput
          label="Email"
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="juan@ejemplo.com"
        />

        <TextInput
          label="Etiquetas"
          value={form.tags}
          onChange={set('tags')}
          hint="Separadas por coma. Se guardan en minúscula."
          placeholder="mayorista, vip"
        />

        <TextArea
          label="Notas"
          value={form.notes}
          onChange={set('notes')}
          rows={4}
          hint="Preferencias, acuerdos, recordatorios. Solo lo ves vos."
          placeholder="Prefiere mate de algarrobo. Paga en efectivo."
        />
      </form>
    </FormModal>
  )
}

// ---------------------------------------------------------------------------
// Ficha del cliente con historial
// ---------------------------------------------------------------------------
function CustomerDetail({ customerId, onClose, onEdit, onChanged, onError }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/customers/${customerId}`, { headers: authHeaders() })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar el cliente')
        if (!cancelled) setDetail(data)
      } catch (err) {
        if (!cancelled) onError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [customerId, onError])

  const customer = detail?.customer
  const stats = detail?.stats

  return (
    <FormModal
      open
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={customer?.name || customer?.phone_display || 'Cliente'}
      subtitle={customer?.phone_display || customer?.phone}
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end">
          {customer?.phone && (
            <a
              href={`https://wa.me/${customer.phone}?text=${encodeURIComponent('¡Hola! Te escribo de MateMáticos 🧉')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-500/10 text-green-400 font-medium hover:bg-green-500/20 transition-colors"
            >
              <HiOutlineChatBubbleLeftEllipsis size={17} />
              WhatsApp
            </a>
          )}
          <button
            onClick={onEdit}
            disabled={!customer}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 text-white/80 font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <HiOutlinePencilSquare size={17} />
            Editar
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      }
    >
      <div className="px-6 sm:px-8 py-6 space-y-6">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && detail && (
          <>
            {/* Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-[0.65rem] uppercase tracking-widest text-white/40 mb-1">Pedidos</p>
                <p className="text-xl font-display font-semibold text-white">{stats.order_count}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-[0.65rem] uppercase tracking-widest text-white/40 mb-1">Total gastado</p>
                <p className="text-xl font-display font-semibold text-primary-light">{formatMoney(stats.total_spent)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-[0.65rem] uppercase tracking-widest text-white/40 mb-1">Ticket promedio</p>
                <p className="text-xl font-display font-semibold text-white">{formatMoney(stats.avg_ticket)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-[0.65rem] uppercase tracking-widest text-white/40 mb-1">Última compra</p>
                <p className="text-sm font-medium text-white mt-1">{formatRelative(stats.last_order_at)}</p>
              </div>
            </div>

            {/* Consultas sin cerrar */}
            {stats.pending_count > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-300">
                  Tiene <strong>{stats.pending_count}</strong>{' '}
                  {stats.pending_count === 1 ? 'consulta' : 'consultas'} sin confirmar. Es a quien conviene
                  seguirle el rato.
                </p>
              </div>
            )}

            {/* Etiquetas y datos */}
            <div className="space-y-3">
              {customer.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map((tag) => (
                    <span key={tag} className="badge badge-geo">{tag}</span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <HiOutlineEnvelope size={15} />
                    {customer.email}
                  </a>
                )}
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <HiOutlinePhone size={15} />
                    {customer.phone_display || customer.phone}
                  </a>
                )}
                <span className="inline-flex items-center gap-2 text-white/40">
                  Cliente desde {formatDate(customer.created_at)}
                </span>
              </div>

              {customer.notes && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[0.65rem] uppercase tracking-widest text-white/40 mb-2">Notas</p>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </div>

            {/* Historial */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Historial de pedidos</h3>

              {detail.orders.length === 0 ? (
                <p className="text-sm text-white/40 py-6 text-center">
                  Todavía no tiene pedidos. Los que haga desde la tienda aparecen acá solos.
                </p>
              ) : (
                <div className="space-y-3">
                  {detail.orders.map((order, index) => {
                    const status = STATUS[order.status] || { label: order.status, cls: 'badge-celeste' }
                    return (
                      <div key={order.order_number || index} className="rounded-xl border border-white/10 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white/5">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs text-white/50">
                              {order.order_number || 'Sin número'}
                            </span>
                            <span className={`badge ${status.cls}`}>{status.label}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-white/40">{formatDateTime(order.created_at)}</span>
                            <span className="text-sm font-semibold text-white">{formatMoney(order.total)}</span>
                          </div>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          {order.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-white/70 min-w-0 truncate">
                                {item.quantity > 1 && <span className="text-white/40">{item.quantity}× </span>}
                                {item.product_name || 'Producto eliminado'}
                                {item.is_combo && (
                                  <span className="ml-2 text-[0.65rem] uppercase tracking-widest text-primary-light/70">combo</span>
                                )}
                              </span>
                              <span className="text-white/50 shrink-0">
                                {formatMoney(Number(item.price_at_order || 0) * (Number(item.quantity) || 1))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </FormModal>
  )
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------
export default function AdminClientes() {
  const router = useRouter()

  const [customers, setCustomers] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('last_order_at')
  const [tagFilter, setTagFilter] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [form, setForm] = useState({ open: false, customer: null })
  const [detailId, setDetailId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, customer: null })

  const { toasts, show: showToast, dismiss } = useToast()

  // showToast cambia de identidad en cada render. Guardarlo en un ref permite
  // usarlo dentro de load() sin que load cambie en cada render (si no, el
  // useEffect de carga se dispararía en loop).
  const toastRef = useRef(showToast)
  useEffect(() => { toastRef.current = showToast }, [showToast])

  // Debounce de la búsqueda: sin esto se dispara un request por tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/admin/login')
      return
    }

    // Si se solapan dos pedidos (fácil con la búsqueda debounced), la respuesta
    // vieja podría pisar a la nueva. `cancelled` evita que la última en llegar
    // gane por casualidad.
    let cancelled = false

    const fetchCustomers = async () => {
      try {
        const params = new URLSearchParams({ sort, page: String(page), perPage: String(PER_PAGE) })
        if (query) params.set('q', query)
        if (tagFilter) params.set('tag', tagFilter)

        const res = await fetch(`/api/customers?${params}`, { headers: authHeaders() })
        if (!res.ok) throw new Error('No se pudieron cargar los clientes')
        const data = await res.json()
        if (cancelled) return

        setCustomers(data.customers || [])
        setTotal(data.total || 0)
        setAvailableTags(data.available_tags || [])
      } catch (err) {
        if (cancelled) return
        toastRef.current(err.message, 'error')
        setCustomers([])
        setTotal(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCustomers()
    return () => { cancelled = true }
  }, [sort, page, query, tagFilter, reloadKey, router])

  // Recarga silenciosa: usar después de crear, editar o borrar.
  const refresh = () => setReloadKey((k) => k + 1)

  // Recarga visible: la usa el botón "Actualizar", que es una acción explícita.
  const hardRefresh = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  const handleDelete = async () => {
    const customer = deleteConfirm.customer
    if (!customer) return
    setDeleteConfirm({ open: false, customer: null })
    try {
      const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE', headers: authHeaders() })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo eliminar')
      }
      toastRef.current('Cliente eliminado', 'success')
      refresh()
    } catch (err) {
      toastRef.current(err.message, 'error')
    }
  }

  const pages = Math.max(Math.ceil(total / PER_PAGE), 1)
  const hasFilters = Boolean(query || tagFilter)
  const isEmptyStore = !loading && total === 0 && !hasFilters

  return (
    <AdminLayout title="Clientes">
      <div className="p-4 sm:p-8 lg:p-10">
        {/* Encabezado */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 mb-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[12rem] lg:w-72">
              <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, teléfono o email..."
                className="input-dark pl-11"
              />
            </div>

            <div className="w-44">
              <Select value={tagFilter} onChange={(e) => { setTagFilter(e.target.value); setPage(1) }}>
                <option value="">Todas las etiquetas</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </Select>
            </div>

            <div className="w-44">
              <Select value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>

            <button
              onClick={hardRefresh}
              title="Actualizar"
              className="p-3 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <HiOutlineArrowPath size={18} />
            </button>
          </div>

          <button
            onClick={() => setForm({ open: true, customer: null })}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-colors shrink-0"
          >
            <HiOutlinePlus size={18} />
            Nuevo cliente
          </button>
        </div>

        {/* Aviso cuando falta correr el backfill */}
        {isEmptyStore && (
          <div className="card-dark text-center py-20 px-6">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center text-primary-light">
              <HiOutlineUsers size={26} />
            </div>
            <p className="text-white font-medium mb-2">Todavía no hay clientes</p>
            <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed">
              Los clientes se crean solos con cada pedido. Si ya tenías pedidos cargados y esta lista
              está vacía, falta correr el backfill: <code className="text-primary-light">npm run seed:customers</code>
            </p>
          </div>
        )}

        {/* Sin resultados con filtros */}
        {!loading && total === 0 && hasFilters && (
          <div className="card-dark text-center py-20 px-6">
            <p className="text-white/40">No hay clientes que coincidan con la búsqueda.</p>
          </div>
        )}

        {/* Tabla */}
        {!loading && total > 0 && (
          <div className="card-dark overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-admin">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th className="text-right">Pedidos</th>
                    <th className="text-right">Total gastado</th>
                    <th>Última compra</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <button
                          onClick={() => setDetailId(customer.id)}
                          className="text-left group"
                        >
                          <span className="block text-white font-medium group-hover:text-primary-light transition-colors">
                            {customer.name || 'Sin nombre'}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 mt-1">
                            {customer.email && (
                              <span className="text-xs text-white/40">{customer.email}</span>
                            )}
                            {customer.tags?.map((tag) => (
                              <span key={tag} className="text-[0.6rem] uppercase tracking-widest text-primary-light/70 border border-primary/20 rounded px-1.5 py-0.5">
                                {tag}
                              </span>
                            ))}
                          </span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap">
                        <a
                          href={`https://wa.me/${customer.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-white/60 hover:text-primary-light transition-colors"
                        >
                          <HiOutlineChatBubbleLeftEllipsis size={15} />
                          {customer.phone_display || customer.phone}
                        </a>
                      </td>
                      <td className="text-right">
                        {customer.order_count > 0 ? (
                          <span className="text-white">{customer.order_count}</span>
                        ) : (
                          <span className="text-white/25">0</span>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {customer.total_spent > 0 ? (
                          <span className="text-primary-light font-medium">{formatMoney(customer.total_spent)}</span>
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-white/50">
                        {formatRelative(customer.last_order_at)}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailId(customer.id)}
                            title="Ver ficha"
                            className="p-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <HiOutlineShoppingBag size={17} />
                          </button>
                          <button
                            onClick={() => setForm({ open: true, customer })}
                            title="Editar"
                            className="p-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <HiOutlinePencilSquare size={17} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ open: true, customer })}
                            title="Eliminar"
                            className="p-2.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <HiOutlineTrash size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pages > 1 && (
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-white/5">
                <p className="text-sm text-white/40">
                  {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} de {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="p-2.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <HiOutlineChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-white/60 px-2">{page} / {pages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, pages))}
                    disabled={page === pages}
                    className="p-2.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <HiOutlineChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conteo arriba de la tabla cuando hay resultados */}
        {!loading && total > 0 && (
          <p className="text-sm text-white/30 mt-4">
            {total} {total === 1 ? 'cliente' : 'clientes'}
            {hasFilters && ' con los filtros aplicados'}
          </p>
        )}
      </div>

      <LoadingModal open={loading} message="Cargando clientes..." />

      {form.open && (
        <CustomerForm
          customer={form.customer}
          onSaved={(message) => {
            setForm({ open: false, customer: null })
            toastRef.current(message, 'success')
            refresh()
          }}
          onCancel={() => setForm({ open: false, customer: null })}
          onError={(message) => toastRef.current(message, 'error')}
        />
      )}

      {detailId && (
        <CustomerDetail
          customerId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const customer = customers.find((c) => c.id === detailId)
            setDetailId(null)
            setForm({ open: true, customer })
          }}
          onChanged={refresh}
          onError={(message) => toastRef.current(message, 'error')}
        />
      )}

      <Confirm
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, customer: null })}
        title="Eliminar cliente"
        message={
          deleteConfirm.customer
            ? `¿Eliminar a "${deleteConfirm.customer.name || deleteConfirm.customer.phone_display}"? Sus pedidos NO se borran: quedan en el historial pero se desvinculan del cliente.`
            : ''
        }
        onConfirm={handleDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="error"
      />

      <ToastStack toasts={toasts} onClose={dismiss} />
    </AdminLayout>
  )
}
