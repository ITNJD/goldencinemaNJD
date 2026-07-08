import { Link } from "react-router-dom";
import { years } from "@/data/mockData";

const YearTimeline = () => {
  const decades = [
    { label: "الخمسينيات", years: years.filter((y) => y >= 1950 && y < 1960) },
    { label: "الستينيات", years: years.filter((y) => y >= 1960 && y < 1970) },
    { label: "السبعينيات", years: years.filter((y) => y >= 1970 && y < 1980) },
    { label: "الثمانينيات", years: years.filter((y) => y >= 1980 && y < 1990) },
    { label: "التسعينيات", years: years.filter((y) => y >= 1990 && y < 2000) },
    { label: "الألفينيات", years: years.filter((y) => y >= 2000 && y < 2010) },
    { label: "العشرينيات", years: years.filter((y) => y >= 2010) },
  ];

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
                  to={`/years?decade=${decade.years[0]}`}
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
                    {decade.years[0]} - {decade.years[decade.years.length - 1] || decade.years[0]}
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
