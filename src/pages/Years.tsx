import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MovieCard from "@/components/MovieCard";
import { useMovies, useYears } from "@/hooks/useMovies";
import { Calendar } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const Years = () => {
  const { data: movies = [], isLoading } = useMovies();
  const { data: years = [] } = useYears();
  const [searchParams] = useSearchParams();
  const decadeParam = searchParams.get("decade");

  const decades = [
    { label: "العشرينات", start: 1920, end: 1929 },
    { label: "الثلاثينيات", start: 1930, end: 1939 },
    { label: "الأربعينات", start: 1940, end: 1949 },
    { label: "الخمسينيات", start: 1950, end: 1959 },
    { label: "الستينيات", start: 1960, end: 1969 },
    { label: "السبعينيات", start: 1970, end: 1979 },
    { label: "الثمانينيات", start: 1980, end: 1989 },
    { label: "التسعينيات", start: 1990, end: 1999 },
    { label: "الألفينات", start: 2000, end: 2026 },
  ];

  const filteredDecades = decadeParam
    ? decades.filter((d) => d.start === parseInt(decadeParam))
    : decades;

  const getMoviesByYear = (year: number) =>
    movies.filter((m) => m.year === year);

  const getDecadeYears = (start: number, end: number) =>
    years.filter((y) => y >= start && y <= end);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-36 pb-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-amiri font-bold text-gradient-gold mb-4">
                تصفح حسب السنوات
              </h1>
            </div>
            <div className="animate-pulse space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted rounded-xl" />
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-36 pb-20">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-amiri font-bold text-gradient-gold mb-4">
              تصفح حسب السنوات
            </h1>
            <p className="text-muted-foreground text-lg">
              رحلة عبر الزمن في تاريخ السينما العربية
            </p>
          </div>

          {/* Decades */}
          {filteredDecades.map((decade) => {
            const decadeYears = getDecadeYears(decade.start, decade.end);
            if (decadeYears.length === 0) return null;

            return (
              <section key={decade.label} className="mb-16">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-gold" />
                  </div>
                  <h2 className="text-3xl font-amiri font-bold text-gradient-gold">
                    {decade.label}
                  </h2>
                </div>

                {decadeYears.map((year) => {
                  const yearMovies = getMoviesByYear(year);
                  if (yearMovies.length === 0) return null;

                  return (
                    <div key={year} className="mb-10">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-2xl font-amiri font-bold text-gold">
                          {year}
                        </span>
                        <div className="flex-1 h-px bg-gold/20" />
                        <span className="text-muted-foreground">
                          {yearMovies.length} أفلام
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {yearMovies.map((movie, idx) => (
                          <MovieCard key={movie.id} movie={movie} index={idx} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}

          {movies.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">لا توجد أفلام حالياً</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Years;
