import { Link } from "react-router-dom";
import { useYears } from "@/hooks/useMovies";

const YearTimeline = () => {
  const { data: years = [], isLoading } = useYears();

  const getDecades = () => {
    const decadeMap: { [key: string]: { label: string; years: number[]; endYear: number } } = {
      "1920": { label: "العشرينات", years: [], endYear: 1929 },
      "1930": { label: "الثلاثينيات", years: [], endYear: 1939 },
      "1940": { label: "الأربعينات", years: [], endYear: 1949 },
      "1950": { label: "الخمسينيات", years: [], endYear: 1959 },
      "1960": { label: "الستينيات", years: [], endYear: 1969 },
      "1970": { label: "السبعينيات", years: [], endYear: 1979 },
      "1980": { label: "الثمانينيات", years: [], endYear: 1989 },
      "1990": { label: "التسعينيات", years: [], endYear: 1999 },
      "2000": { label: "الألفينات", years: [], endYear: 2026 },
    };

    years.forEach((year) => {
      if (year >= 2000) {
        decadeMap["2000"].years.push(year);
      } else {
        const decade = Math.floor(year / 10) * 10;
        const key = decade.toString();
        if (decadeMap[key]) {
          decadeMap[key].years.push(year);
        }
      }
    });

    return Object.entries(decadeMap)
      .filter(([_, d]) => d.years.length > 0)
      .map(([key, d]) => ({
        ...d,
        startYear: parseInt(key),
        years: d.years.sort((a, b) => a - b),
      }));
  };

  const decades = getDecades();

  if (isLoading) {
    return (
      <section className="py-20 bg-gradient-cinema">
        <div className="container mx-auto px-4">
          <h2 className="section-title text-center">تصفح حسب السنوات</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="cinema-card p-4 animate-pulse">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gold/20" />
                <div className="h-4 bg-muted rounded mx-auto w-20" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (decades.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-gradient-cinema">
      <div className="container mx-auto px-4">
        <h2 className="section-title text-center">تصفح حسب السنوات</h2>

        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gold/30 hidden md:block" />

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {decades.map((decade, idx) => (
              <div
                key={decade.label}
                className="relative animate-fade-in-up"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <Link
                  to={`/years?decade=${decade.startYear}`}
                  className="cinema-card p-4 text-center block group"
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gold/20 flex items-center justify-center group-hover:bg-gold/40 transition-colors">
                    <span className="text-gold font-bold">
                      {decade.years.length}
                    </span>
                  </div>
                  <h3 className="font-amiri font-bold text-foreground group-hover:text-gold transition-colors">
                    {decade.label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {decade.startYear} - {decade.endYear}
                  </p>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default YearTimeline;
