import { Suspense } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router';

import InputSection from './components/InputSection';
import MainStaffRenderer from './components/MainStaffRenderer';
import {
  defaultLesson,
  findLessonById,
  getLessonPath,
  lessons,
} from './features/musicxml/lessonCatalog';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from './components/ui/sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './components/ui/breadcrumb';

import { AppSidebar } from './components/app-sidebar';
import { Separator } from './components/ui/separator';
import { InputRuntimeProvider } from './features/input/InputRuntimeContext';

/**
 * Render the application route tree.
 * @returns App element.
 */
function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DefaultLessonRedirect />} />
        <Route path="input" element={<InputRoute />} />
        <Route path="lesson/:id" element={<LessonRoute />} />
        <Route path="*" element={<DefaultLessonRedirect />} />
      </Route>
    </Routes>
  );
}

function AppLayout() {
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
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </InputRuntimeProvider>
  );
}

function DefaultLessonRedirect() {
  if (!defaultLesson) {
    return <NoLessonsState />;
  }

  return <Navigate to={getLessonPath(defaultLesson.id)} replace />;
}

function LessonRoute() {
  const { id } = useParams();
  const selectedLesson = findLessonById(id);

  if (!selectedLesson) {
    return <DefaultLessonRedirect />;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MainStaffRenderer selectedLesson={selectedLesson} />
    </Suspense>
  );
}

function InputRoute() {
  return <InputSection />;
}

function NoLessonsState() {
  return (
    <section className="rounded-3xl border border-black/10 bg-white/85 p-6">
      <h2 className="text-lg font-semibold text-black">No lessons available</h2>
      <p className="mt-2 text-sm text-black/60">
        Add a MusicXML lesson under `lessons/` to populate the router.
      </p>
    </section>
  );
}

export default App;
