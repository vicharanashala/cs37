interface PopularSearchesProps {
  onSelect: (term: string) => void;
}

export default function PopularSearches({
  onSelect,
}: PopularSearchesProps) {
  const searches = [
    "NOC Deadline",
    "Leave Policy",
    "Attendance",
    "Certificate",
    "Stipend",
  ];

  return (
    <div className="mt-4">
      <p className="text-sm font-medium mb-2">
        Popular Searches
      </p>

      <div className="flex flex-wrap gap-2">
        {searches.map((item) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className="px-3 py-1 rounded-full border text-sm hover:bg-gray-100"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}