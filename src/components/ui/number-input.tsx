import { forwardRef, InputHTMLAttributes, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  integer?: boolean;
  decimals?: number;
  min?: number;
  max?: number;
}

/**
 * NumberInput: arregla la UX del 0 (selecciona al enfocar)
 * - integer=true → step=1, sube de 1 en 1, sin decimales
 * - decimals (default 2) → step=0.01 para precios
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, integer = false, decimals = 2, min, max, className, ...rest }, ref) => {
    const [internal, setInternal] = useState<string>(
      value === null || value === undefined || value === "" ? "" : String(value)
    );

    useEffect(() => {
      const cur = value === null || value === undefined ? "" : String(value);
      // Solo sincronizar si el valor externo difiere del numérico actual
      if (cur !== internal && Number(cur) !== Number(internal)) {
        setInternal(cur);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    // Las flechas siempre suben/bajan en enteros (UX consistente). El usuario puede tipear decimales libremente.
    const step = 1;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // permitir vacío durante edición
      if (raw === "" || raw === "-") {
        setInternal(raw);
        onChange(0);
        return;
      }
      const cleaned = integer ? raw.replace(/[^\d-]/g, "") : raw.replace(/[^\d.\-]/g, "");
      setInternal(cleaned);
      const parsed = integer ? parseInt(cleaned, 10) : parseFloat(cleaned);
      if (!isNaN(parsed)) onChange(parsed);
    };

    const handleBlur = () => {
      if (internal === "" || internal === "-") {
        setInternal("0");
        onChange(0);
        return;
      }
      let n = integer ? parseInt(internal, 10) : parseFloat(internal);
      if (isNaN(n)) n = 0;
      if (typeof min === "number" && n < min) n = min;
      if (typeof max === "number" && n > max) n = max;
      // Solo formatear con decimales si el valor tiene fracción real
      const finalStr = integer || Number.isInteger(n) ? String(n) : n.toFixed(decimals);
      setInternal(finalStr);
      onChange(n);
    };

    // Bloquear cambio de valor por scroll del ratón (UX confusa con decimales)
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      (e.target as HTMLInputElement).blur();
    };

    return (
      <Input
        ref={ref}
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        step={step}
        min={min}
        max={max}
        value={internal}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
        onWheel={handleWheel}
        className={cn(className)}
        {...rest}
      />
    );
  }
);
NumberInput.displayName = "NumberInput";
