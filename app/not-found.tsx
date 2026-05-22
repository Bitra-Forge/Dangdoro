import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* 404 Display */}
        <div className="relative">
          <span className="text-[120px] font-black text-white/[0.03] leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-[#C9B037]/10 border border-[#C9B037]/20 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-[#C9B037]/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Message */}
        <div>
          <h1 className="text-xl font-bold text-white mb-2">
            Page Not Found
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            This path doesn&apos;t lead anywhere in the forge. Check the URL or
            head back to familiar territory.
          </p>
        </div>

        {/* Action */}
        <Link
          href="/"
          className="inline-flex px-6 py-2.5 bg-[#C9B037]/10 hover:bg-[#C9B037]/20 border border-[#C9B037]/20 rounded-xl text-sm font-medium text-[#C9B037] transition-all"
        >
          Return to the Forge
        </Link>
      </div>
    </div>
  );
}
