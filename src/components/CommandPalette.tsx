'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { createClient } from '@/lib/supabaseClient'

// ... (tus interfaces aquí)

export default function CommandPalette() {
  const supabase = createClient(); // <-- LA CORRECCIÓN
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState<any[]>([]); // Usa tipos más específicos si los tienes

  // Lógica para abrir/cerrar con atajo de teclado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Lógica para cargar los datos
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const classesPromise = supabase.from('classes').select('id, name').eq('user_id', user.id);
    const examsPromise = supabase.from('exams').select('id, name, class_id').eq('user_id', user.id);

    const [classesResult, examsResult] = await Promise.all([classesPromise, examsPromise]);

    const allPages = [
      ...(classesResult.data || []).map(c => ({ ...c, type: 'Clase', url: `/dashboard/class/${c.id}` })),
      ...(examsResult.data || []).map(e => ({ ...e, type: 'Examen', url: `/dashboard/class/${e.class_id}/exam/${e.id}` }))
    ];
    setPages(allPages);
  }, [supabase]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Búsqueda Global">
      <Command.Input value={search} onValueChange={setSearch} placeholder="Buscar clases, exámenes..." />
      <Command.List>
        <Command.Empty>No se encontraron resultados.</Command.Empty>

        <Command.Group heading="Clases">
          {pages.filter(p => p.type === 'Clase').map((page) => (
            <Command.Item key={page.id} onSelect={() => runCommand(() => router.push(page.url))}>
              {page.name}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Exámenes">
          {pages.filter(p => p.type === 'Examen').map((page) => (
            <Command.Item key={page.id} onSelect={() => runCommand(() => router.push(page.url))}>
              {page.name}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}