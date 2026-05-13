export function TabPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-xl font-medium text-gray-800">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p>
      <span className="mt-4 rounded bg-gray-100 px-3 py-1 text-xs uppercase tracking-wide text-gray-600">
        Coming in a later phase
      </span>
    </div>
  );
}
