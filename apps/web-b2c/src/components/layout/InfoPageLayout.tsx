import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/Footer';
import { ArrowLeft } from 'lucide-react';

interface InfoPageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

const InfoPageLayout = ({ title, subtitle, children }: InfoPageLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
          {/* Header */}
          <div className="mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {title}
            </h1>
            {subtitle && (
              <p className="text-lg md:text-xl text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          {/* Content Area */}
          <div className="prose prose-zinc max-w-none">
            {children}
          </div>

          {/* CTA Section */}
          <div className="mt-12 md:mt-16 pt-8 border-t border-border">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                ¿Listo para explorar la vida nocturna?
              </p>
              <Link to="/">
                <Button size="lg" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inicio
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default InfoPageLayout;
