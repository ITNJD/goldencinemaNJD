import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Movies from "./pages/Movies";
import Artists from "./pages/Artists";
import Years from "./pages/Years";
import MovieDetail from "./pages/MovieDetail";
import ArtistDetail from "./pages/ArtistDetail";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import VoiceAssistant from "./components/VoiceAssistant";
import BackgroundMusic from "./components/BackgroundMusic";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/years" element={<Years />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="/artist/:id" element={<ArtistDetail />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <VoiceAssistant />
        <BackgroundMusic />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
