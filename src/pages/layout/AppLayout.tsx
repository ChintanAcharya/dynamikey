import { Link, Outlet, useLocation, useParams } from 'react-router';

import { AppSidebar } from '@/features/app-shell/components/AppSidebar';
import { InputRuntimeProvider } from '@/features/input/InputRuntimeContext';
import {
  defaultLesson,
  findLessonById,
  getLessonPath,
  lessons,
} from '@/features/musicxml/lessonCatalog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export function AppLayout() {
  const location = useLocation();
  const { id } = useParams();
  const selectedLesson = findLessonById(id);
  const defaultLessonPath = defaultLesson
    ? getLessonPath(defaultLesson.id)
    : null;
  const isInputRoute = location.pathname === '/input';
  const breadcrumbTitle = isInputRoute
    ? 'Input'
    : (selectedLesson?.title ?? 'Lesson');

  return (
    <InputRuntimeProvider>
      <SidebarProvider>
        <AppSidebar
          defaultLessonPath={defaultLessonPath}
          lessons={lessons}
          selectedLessonId={selectedLesson?.id ?? ''}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  {isInputRoute ? null : (
                    <>
                      <BreadcrumbItem className="hidden md:block">
                        {defaultLessonPath ? (
                          <BreadcrumbLink asChild>
                            <Link to={defaultLessonPath}>Lessons</Link>
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>Lessons</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block" />
                    </>
                  )}
                  <BreadcrumbItem>
                    <BreadcrumbPage>{breadcrumbTitle}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </InputRuntimeProvider>
  );
}
