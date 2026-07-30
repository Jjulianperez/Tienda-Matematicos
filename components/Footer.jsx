export default function Footer() {
  return (
    <footer className="bg-carbon border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-lg text-beige font-light italic">
            Toda gran idea comienza con un mate.
          </p>
          <p className="mt-2 text-sm text-white/30">
            MateMáticos &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
