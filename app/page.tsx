import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { EmptyState } from '../components/ui/empty-state'
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/table'

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="w-full bg-navbar px-6 py-4 flex items-center justify-between">
        <div className="text-text font-semibold text-xl">Exora</div>
        <Button variant="gradient">Cambiar sucursal</Button>
      </nav>
      <main className="flex-1 container mx-auto p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-2xl font-semibold text-brand-blue mb-4">Registro del Día</h2>
            <EmptyState title="Completa el formulario para registrar" />
          </Card>
          <Card>
            <h2 className="text-2xl font-semibold text-brand-blue mb-4">Historial</h2>
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH>Ingresos</TH>
                  <TH>Cierre</TH>
                </TR>
              </THead>
              <TBody>
                <TR>
                  <TD>01/01/2024</TD>
                  <TD className="text-right">100€</TD>
                  <TD className="text-right">90€</TD>
                </TR>
                <TR>
                  <TD>02/01/2024</TD>
                  <TD className="text-right">120€</TD>
                  <TD className="text-right">110€</TD>
                </TR>
              </TBody>
            </Table>
          </Card>
        </div>
        <div className="flex gap-4">
          <Button variant="primary">Guardar</Button>
          <Button variant="pink">Nuevo</Button>
          <Button variant="destructive">Borrar</Button>
        </div>
      </main>
    </div>
  )
}
