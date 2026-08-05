import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FormField({
  id,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  textarea,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {textarea ? (
        <Textarea
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl"
        />
      ) : (
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl"
        />
      )}
    </div>
  );
}
