import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Cria uma resposta inicial que pode ser modificada
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verifica se o usuário tem uma sessão ativa
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Rotas públicas (acessíveis sem login): login e cadastro
  const publicRoutes = ['/login', '/signup']
  const isPublicRoute = publicRoutes.includes(path)

  // Se NÃO estiver logado e tentar acessar qualquer página protegida
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se ESTIVER logado e tentar acessar login/cadastro, manda pro início
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Define quais rotas o middleware deve monitorar
export const config = {
  matcher: [
    /*
     * Intercepta todas as rotas, exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (imagens otimizadas)
     * - favicon.ico (ícone do site)
     * - imagens na pasta public
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}