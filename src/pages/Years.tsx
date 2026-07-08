import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MovieCard from "@/components/MovieCard";
import { movies, years } from "@/data/mockData";
import { Calendar } from "lucide-react";

const Years = () => {
  const decades = [
    { label: "الخمسينيات", start: 1950, end: 1959 },
    { label: "الستينيات", start: 1960, end: 1969 },
    { label: "السبعينيات", start: 1970, end: 1979 },
    { label: "الثمانينيات", start: 1980, end: 1989 },
    { label: "التسعينيات", start: 1990, end: 1999 },
    { label: "الألفينيات", start: 2000, end: 2009 },
    { label: "العشرينيات", start: 2010, end: 2019 },
  ];

  const getMoviesByYear = (year: number) =>
    movies.filter((m) => m.year === year);

  const getDecadeYears = (start: number, end: number) =>
    years.filter((y) => y >= start && y <= end);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-28 pb-20">
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
          {decades.map((decade) => {
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
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Years;
