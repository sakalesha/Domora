from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.core.security import hash_password
from app.models.domain import (
    Booking,
    Camp,
    CampPriceTier,
    JobRecord,
    Service,
    Society,
    User,
)

DEFAULT_DEMO_PASSWORD = "DomoraDemo2026!"
DEFAULT_OPS_PASSWORD = "DomoraOpsDemo2026!"
DEFAULT_VENDOR_PASSWORD = "DomoraVendorDemo2026!"
DEFAULT_RESIDENT_PASSWORD = "Password123!"


def seed_ops_demo() -> None:
    print("🌱 Starting Domora Operations Demo Seeding...")

    # Pre-compute password hashes to keep execution under 1 second
    hashed_ops_pw = hash_password(DEFAULT_OPS_PASSWORD)
    hashed_vendor_pw = hash_password(DEFAULT_VENDOR_PASSWORD)
    hashed_resident_pw = hash_password(DEFAULT_RESIDENT_PASSWORD)
    hashed_demo_pw = hash_password(DEFAULT_DEMO_PASSWORD)

    with SessionLocal() as session:
        # 1. Societies
        societies_data = [
            {
                "name": "Sunrise Heights",
                "address": "1 Main Road, Bellandur",
                "city": "Bengaluru",
                "invite_code": "SUNRISE-DEMO",
            },
            {
                "name": "Prestige Lakeside Habitat",
                "address": "SH-35, Varthur Road, Whitefield",
                "city": "Bengaluru",
                "invite_code": "PRESTIGE-DEMO",
            },
            {
                "name": "Sobha Forest View",
                "address": "100ft Inner Ring Road, Banashankari 6th Stage",
                "city": "Bengaluru",
                "invite_code": "SOBHA-DEMO",
            },
            {
                "name": "Brigade Gateway",
                "address": "26/1 Dr. Rajkumar Road, Malleshwaram-Rajajinagar",
                "city": "Bengaluru",
                "invite_code": "BRIGADE-DEMO",
            },
        ]

        societies_by_code: dict[str, Society] = {}
        for s_data in societies_data:
            existing = session.scalar(
                select(Society).where(Society.invite_code == s_data["invite_code"])
            )
            if existing is None:
                soc = Society(**s_data)
                session.add(soc)
                session.flush()
                societies_by_code[s_data["invite_code"]] = soc
                print(f"  + Added Society: {soc.name} ({soc.invite_code})")
            else:
                existing.name = s_data["name"]
                existing.address = s_data["address"]
                existing.city = s_data["city"]
                societies_by_code[s_data["invite_code"]] = existing
                print(f"  ✓ Existing Society: {existing.name} ({existing.invite_code})")

        # 2. Services
        services_data = [
            ("pest_control", "Pest control"),
            ("ac_service", "AC servicing"),
            ("deep_cleaning", "Deep home cleaning"),
            ("sofa_shampoo", "Sofa & upholstery shampooing"),
        ]

        services_by_code: dict[str, Service] = {}
        for code, name in services_data:
            existing = session.scalar(select(Service).where(Service.code == code))
            if existing is None:
                srv = Service(code=code, name=name)
                session.add(srv)
                session.flush()
                services_by_code[code] = srv
                print(f"  + Added Service: {srv.name} ({srv.code})")
            else:
                existing.name = name
                services_by_code[code] = existing
                print(f"  ✓ Existing Service: {existing.name} ({existing.code})")

        # 3. Privileged Users (Ops & Vendors)
        users_by_username: dict[str, User] = {}

        # Ops Admin
        ops_user = session.scalar(select(User).where(User.username == "ops_admin"))
        if ops_user is None:
            ops_user = User(
                username="ops_admin",
                password_hash=hashed_ops_pw,
                full_name="Domora Operations Team",
                phone="+919876543210",
                role="ops",
                is_active=True,
            )
            session.add(ops_user)
            session.flush()
            print("  + Added User: ops_admin (ops)")
        else:
            ops_user.full_name = "Domora Operations Team"
            ops_user.is_active = True
            print("  ✓ Existing User: ops_admin (ops)")
        users_by_username["ops_admin"] = ops_user

        # Vendors
        vendors_data = [
            {
                "username": "vendor_pro",
                "full_name": "Apex Facilities & Services",
                "phone": "+919876543211",
                "password": DEFAULT_VENDOR_PASSWORD,
            },
            {
                "username": "vendor_coolbreeze",
                "full_name": "CoolBreeze AC & Electricals",
                "phone": "+919876543221",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "vendor_urban",
                "full_name": "Urban Sparkle Deep Clean Pro",
                "phone": "+919876543222",
                "password": DEFAULT_DEMO_PASSWORD,
            },
        ]

        for v_data in vendors_data:
            existing = session.scalar(select(User).where(User.username == v_data["username"]))
            if existing is None:
                pw_hash = hashed_vendor_pw if v_data["username"] == "vendor_pro" else hashed_demo_pw
                vend = User(
                    username=v_data["username"],
                    password_hash=pw_hash,
                    full_name=v_data["full_name"],
                    phone=v_data["phone"],
                    role="vendor",
                    is_active=True,
                )
                session.add(vend)
                session.flush()
                users_by_username[v_data["username"]] = vend
                print(f"  + Added Vendor: {vend.full_name} ({vend.username})")
            else:
                existing.full_name = v_data["full_name"]
                existing.is_active = True
                users_by_username[v_data["username"]] = existing
                print(f"  ✓ Existing Vendor: {existing.full_name} ({existing.username})")

        # 4. Residents
        residents_data = [
            # Sunrise Heights residents
            {
                "username": "resident_demo",
                "full_name": "Demo Resident",
                "phone": "+919876543212",
                "society_code": "SUNRISE-DEMO",
                "unit_label": "A-101",
                "password": DEFAULT_RESIDENT_PASSWORD,
            },
            {
                "username": "res_sh_1",
                "full_name": "Aarav Patel",
                "phone": "+919876540101",
                "society_code": "SUNRISE-DEMO",
                "unit_label": "A-204",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_sh_2",
                "full_name": "Priya Sharma",
                "phone": "+919876540102",
                "society_code": "SUNRISE-DEMO",
                "unit_label": "B-502",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_sh_3",
                "full_name": "Rohan Gupta",
                "phone": "+919876540103",
                "society_code": "SUNRISE-DEMO",
                "unit_label": "C-103",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_sh_4",
                "full_name": "Ananya Iyer",
                "phone": "+919876540104",
                "society_code": "SUNRISE-DEMO",
                "unit_label": "A-701",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_sh_5",
                "full_name": "Vikram Malhotra",
                "phone": "+919876540105",
                "society_code": "SUNRISE-DEMO",
                "unit_label": "B-304",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            # Prestige Lakeside residents
            {
                "username": "res_pl_1",
                "full_name": "Kavita Nair",
                "phone": "+919876540201",
                "society_code": "PRESTIGE-DEMO",
                "unit_label": "Tower 3-402",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_pl_2",
                "full_name": "Siddharth Rao",
                "phone": "+919876540202",
                "society_code": "PRESTIGE-DEMO",
                "unit_label": "Tower 5-1101",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_pl_3",
                "full_name": "Meera Nambiar",
                "phone": "+919876540203",
                "society_code": "PRESTIGE-DEMO",
                "unit_label": "Tower 1-205",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_pl_4",
                "full_name": "Arjun Menon",
                "phone": "+919876540204",
                "society_code": "PRESTIGE-DEMO",
                "unit_label": "Tower 8-704",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_pl_5",
                "full_name": "Tanvi Joshi",
                "phone": "+919876540205",
                "society_code": "PRESTIGE-DEMO",
                "unit_label": "Tower 2-603",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            # Sobha Forest View residents
            {
                "username": "res_sf_1",
                "full_name": "Rajesh Kumar",
                "phone": "+919876540301",
                "society_code": "SOBHA-DEMO",
                "unit_label": "Pine-102",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_sf_2",
                "full_name": "Deepa Venkat",
                "phone": "+919876540302",
                "society_code": "SOBHA-DEMO",
                "unit_label": "Cedar-405",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_sf_3",
                "full_name": "Gautam Sen",
                "phone": "+919876540303",
                "society_code": "SOBHA-DEMO",
                "unit_label": "Oak-801",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_sf_4",
                "full_name": "Pooja Hegde",
                "phone": "+919876540304",
                "society_code": "SOBHA-DEMO",
                "unit_label": "Maple-302",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            # Brigade Gateway residents
            {
                "username": "res_bg_1",
                "full_name": "Aditya Verma",
                "phone": "+919876540401",
                "society_code": "BRIGADE-DEMO",
                "unit_label": "Canary-501",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_bg_2",
                "full_name": "Sneha Roy",
                "phone": "+919876540402",
                "society_code": "BRIGADE-DEMO",
                "unit_label": "Oriole-204",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_bg_3",
                "full_name": "Karan Kapoor",
                "phone": "+919876540403",
                "society_code": "BRIGADE-DEMO",
                "unit_label": "Robin-1002",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_bg_4",
                "full_name": "Divya Reddy",
                "phone": "+919876540404",
                "society_code": "BRIGADE-DEMO",
                "unit_label": "Canary-903",
                "password": DEFAULT_DEMO_PASSWORD,
            },
            {
                "username": "res_bg_5",
                "full_name": "Manish Agarwal",
                "phone": "+919876540405",
                "society_code": "BRIGADE-DEMO",
                "unit_label": "Oriole-701",
                "password": DEFAULT_DEMO_PASSWORD,
            },
        ]

        for r_data in residents_data:
            existing = session.scalar(select(User).where(User.username == r_data["username"]))
            soc = societies_by_code[r_data["society_code"]]
            if existing is None:
                pw_hash = hashed_resident_pw if r_data["username"] == "resident_demo" else hashed_demo_pw
                res = User(
                    username=r_data["username"],
                    password_hash=pw_hash,
                    full_name=r_data["full_name"],
                    phone=r_data["phone"],
                    role="resident",
                    society_id=soc.id,
                    unit_label=r_data["unit_label"],
                    is_active=True,
                )
                session.add(res)
                session.flush()
                users_by_username[r_data["username"]] = res
                print(f"  + Added Resident: {res.full_name} ({res.unit_label}, {soc.name})")
            else:
                existing.full_name = r_data["full_name"]
                existing.society_id = soc.id
                existing.unit_label = r_data["unit_label"]
                existing.is_active = True
                users_by_username[r_data["username"]] = existing
                print(f"  ✓ Existing Resident: {existing.full_name} ({existing.unit_label})")

        session.commit()

        # 5. Clean up existing demo camps to refresh them relative to current clock
        demo_titles = [
            "Pre-Monsoon AC Health Checkup",
            "Society Comprehensive Pest Eradication",
            "Balcony & Window Deep Sanitization",
            "Premium Sofa & Upholstery Revival",
            "Pre-Summer AC Deep Clean & Gas Check",
            "Society Monsoon Anti-Dengue Fogging & Spray",
            "Full Villa & Apartment Deep Scrubbing",
            "Balcony Pigeon Netting Drive",
        ]

        camp_ids_to_del = session.scalars(
            select(Camp.id).where(Camp.title.in_(demo_titles))
        ).all()
        if camp_ids_to_del:
            booking_ids = session.scalars(
                select(Booking.id).where(Booking.camp_id.in_(camp_ids_to_del))
            ).all()
            if booking_ids:
                session.execute(
                    delete(JobRecord).where(JobRecord.booking_id.in_(booking_ids))
                )
                session.execute(
                    delete(Booking).where(Booking.id.in_(booking_ids))
                )
            session.execute(
                delete(CampPriceTier).where(CampPriceTier.camp_id.in_(camp_ids_to_del))
            )
            session.execute(
                delete(Camp).where(Camp.id.in_(camp_ids_to_del))
            )
            session.commit()
            print(f"  🧹 Cleaned {len(camp_ids_to_del)} old demo camps to ensure fresh timestamps.")

        # 6. Create 8 Rich Camps with Dynamic Pricing Tiers, Bookings, and Job Records
        now = datetime.now(timezone.utc)

        # CAMP 1: Critical Triage (Open, closes in 12h, needs 3 more)
        c1_starts = now + timedelta(hours=36)
        c1_ends = c1_starts + timedelta(hours=8)
        c1_deadline = c1_starts - timedelta(hours=24)  # now + 12h (exactly 24h prior)
        camp1 = Camp(
            society_id=societies_by_code["SUNRISE-DEMO"].id,
            service_id=services_by_code["ac_service"].id,
            title="Pre-Monsoon AC Health Checkup",
            starts_at=c1_starts,
            ends_at=c1_ends,
            slot_minutes=60,
            min_participants=5,
            max_participants=8,
            join_deadline=c1_deadline,
            base_price_paise=79900,  # ₹799
            status="open",
            vendor_id=users_by_username["vendor_coolbreeze"].id,
            created_by=users_by_username["ops_admin"].id,
        )
        session.add(camp1)
        session.flush()
        # Price Tiers for Camp 1
        for min_p, disc in [(1, 0), (3, 10), (5, 20), (7, 30)]:
            session.add(CampPriceTier(camp_id=camp1.id, min_participants=min_p, discount_pct=disc))
        # Bookings (2 joined -> needs 3 more, closes in 12h)
        for res_name in ["res_sh_1", "res_sh_2"]:
            session.add(
                Booking(
                    camp_id=camp1.id,
                    resident_id=users_by_username[res_name].id,
                    status="joined",
                    quoted_price_paise=79900,
                )
            )
        print("  + Created Camp 1: Pre-Monsoon AC Health Checkup (CRITICAL AT-RISK)")

        # CAMP 2: Warning Triage (Open, 5 joined, NO VENDOR ASSIGNED)
        c2_starts = now + timedelta(days=5)
        c2_ends = c2_starts + timedelta(hours=8)
        c2_deadline = c2_starts - timedelta(days=2)  # 48h before starts_at
        camp2 = Camp(
            society_id=societies_by_code["PRESTIGE-DEMO"].id,
            service_id=services_by_code["pest_control"].id,
            title="Society Comprehensive Pest Eradication",
            starts_at=c2_starts,
            ends_at=c2_ends,
            slot_minutes=60,
            min_participants=4,
            max_participants=8,
            join_deadline=c2_deadline,
            base_price_paise=129900,  # ₹1,299
            status="open",
            vendor_id=None,  # NO VENDOR -> Attention Needed
            created_by=users_by_username["ops_admin"].id,
        )
        session.add(camp2)
        session.flush()
        for min_p, disc in [(1, 0), (4, 15), (6, 25)]:
            session.add(CampPriceTier(camp_id=camp2.id, min_participants=min_p, discount_pct=disc))
        for res_name in ["res_pl_1", "res_pl_2", "res_pl_3", "res_pl_4", "res_pl_5"]:
            session.add(
                Booking(
                    camp_id=camp2.id,
                    resident_id=users_by_username[res_name].id,
                    status="joined",
                    quoted_price_paise=129900,
                )
            )
        print("  + Created Camp 2: Society Comprehensive Pest Eradication (WARNING - NO VENDOR)")

        # CAMP 3: Warning Triage (Open, 1 joined, closes in 48h, needs 4 more)
        c3_starts = now + timedelta(days=4)
        c3_ends = c3_starts + timedelta(hours=8)
        c3_deadline = now + timedelta(hours=48)  # exactly 48h left, which is 48h before starts_at
        camp3 = Camp(
            society_id=societies_by_code["SOBHA-DEMO"].id,
            service_id=services_by_code["deep_cleaning"].id,
            title="Balcony & Window Deep Sanitization",
            starts_at=c3_starts,
            ends_at=c3_ends,
            slot_minutes=60,
            min_participants=5,
            max_participants=8,
            join_deadline=c3_deadline,
            base_price_paise=199900,  # ₹1,999
            status="open",
            vendor_id=users_by_username["vendor_urban"].id,
            created_by=users_by_username["ops_admin"].id,
        )
        session.add(camp3)
        session.flush()
        for min_p, disc in [(1, 0), (3, 10), (5, 20)]:
            session.add(CampPriceTier(camp_id=camp3.id, min_participants=min_p, discount_pct=disc))
        session.add(
            Booking(
                camp_id=camp3.id,
                resident_id=users_by_username["res_sf_1"].id,
                status="joined",
                quoted_price_paise=199900,
            )
        )
        print("  + Created Camp 3: Balcony & Window Deep Sanitization (WARNING - LOW VELOCITY)")

        # CAMP 4: Healthy Open (5 joined / min 4, 15% unlocked, 5 days left)
        c4_starts = now + timedelta(days=7)
        c4_ends = c4_starts + timedelta(hours=10)
        c4_deadline = c4_starts - timedelta(days=2)
        camp4 = Camp(
            society_id=societies_by_code["BRIGADE-DEMO"].id,
            service_id=services_by_code["sofa_shampoo"].id,
            title="Premium Sofa & Upholstery Revival",
            starts_at=c4_starts,
            ends_at=c4_ends,
            slot_minutes=60,
            min_participants=4,
            max_participants=10,
            join_deadline=c4_deadline,
            base_price_paise=149900,  # ₹1,499
            status="open",
            vendor_id=users_by_username["vendor_urban"].id,
            created_by=users_by_username["ops_admin"].id,
        )
        session.add(camp4)
        session.flush()
        for min_p, disc in [(1, 0), (4, 15), (7, 25), (10, 35)]:
            session.add(CampPriceTier(camp_id=camp4.id, min_participants=min_p, discount_pct=disc))
        for res_name in ["res_bg_1", "res_bg_2", "res_bg_3", "res_bg_4", "res_bg_5"]:
            session.add(
                Booking(
                    camp_id=camp4.id,
                    resident_id=users_by_username[res_name].id,
                    status="joined",
                    quoted_price_paise=149900,
                )
            )
        print("  + Created Camp 4: Premium Sofa & Upholstery Revival (HEALTHY OPEN)")

        # CAMP 5: Confirmed (Deadline passed, 4 residents scheduled in slots)
        c5_starts = now + timedelta(days=2)
        c5_ends = c5_starts + timedelta(hours=6)
        c5_deadline = now - timedelta(hours=12)
        camp5 = Camp(
            society_id=societies_by_code["SUNRISE-DEMO"].id,
            service_id=services_by_code["ac_service"].id,
            title="Pre-Summer AC Deep Clean & Gas Check",
            starts_at=c5_starts,
            ends_at=c5_ends,
            slot_minutes=60,
            min_participants=3,
            max_participants=6,
            join_deadline=c5_deadline,
            base_price_paise=89900,  # ₹899
            status="confirmed",
            vendor_id=users_by_username["vendor_pro"].id,
            created_by=users_by_username["ops_admin"].id,
        )
        session.add(camp5)
        session.flush()
        for min_p, disc in [(1, 0), (3, 15), (5, 25)]:
            session.add(CampPriceTier(camp_id=camp5.id, min_participants=min_p, discount_pct=disc))
        # Scheduled bookings
        scheduled_residents = ["res_sh_3", "res_sh_4", "res_sh_5", "resident_demo"]
        for idx, res_name in enumerate(scheduled_residents):
            session.add(
                Booking(
                    camp_id=camp5.id,
                    resident_id=users_by_username[res_name].id,
                    status="scheduled",
                    quoted_price_paise=89900,
                    final_price_paise=76400,  # 15% discount unlocked (₹764)
                    slot_starts_at=c5_starts + timedelta(hours=idx),
                )
            )
        print("  + Created Camp 5: Pre-Summer AC Deep Clean & Gas Check (CONFIRMED)")

        # CAMP 6: In Progress (Live today, vendor actively dispatching)
        c6_starts = now - timedelta(hours=3)
        c6_ends = c6_starts + timedelta(hours=8)
        c6_deadline = c6_starts - timedelta(days=2)
        camp6 = Camp(
            society_id=societies_by_code["BRIGADE-DEMO"].id,
            service_id=services_by_code["pest_control"].id,
            title="Society Monsoon Anti-Dengue Fogging & Spray",
            starts_at=c6_starts,
            ends_at=c6_ends,
            slot_minutes=60,
            min_participants=3,
            max_participants=8,
            join_deadline=c6_deadline,
            base_price_paise=119900,  # ₹1,199
            status="in_progress",
            vendor_id=users_by_username["vendor_pro"].id,
            created_by=users_by_username["ops_admin"].id,
        )
        session.add(camp6)
        session.flush()
        for min_p, disc in [(1, 0), (3, 20)]:
            session.add(CampPriceTier(camp_id=camp6.id, min_participants=min_p, discount_pct=disc))

        # Booking 1: Completed with job record
        b6_1 = Booking(
            camp_id=camp6.id,
            resident_id=users_by_username["res_bg_1"].id,
            status="completed",
            quoted_price_paise=119900,
            final_price_paise=95900,
            slot_starts_at=c6_starts,
        )
        session.add(b6_1)
        session.flush()
        session.add(
            JobRecord(
                booking_id=b6_1.id,
                vendor_id=users_by_username["vendor_pro"].id,
                before_photo_path="uploads/demo/pest_before_1.jpg",
                after_photo_path="uploads/demo/pest_after_1.jpg",
                started_at=c6_starts,
                completed_at=c6_starts + timedelta(minutes=50),
            )
        )

        # Booking 2: Completed with job record
        b6_2 = Booking(
            camp_id=camp6.id,
            resident_id=users_by_username["res_bg_2"].id,
            status="completed",
            quoted_price_paise=119900,
            final_price_paise=95900,
            slot_starts_at=c6_starts + timedelta(hours=1),
        )
        session.add(b6_2)
        session.flush()
        session.add(
            JobRecord(
                booking_id=b6_2.id,
                vendor_id=users_by_username["vendor_pro"].id,
                before_photo_path="uploads/demo/pest_before_2.jpg",
                after_photo_path="uploads/demo/pest_after_2.jpg",
                started_at=c6_starts + timedelta(hours=1),
                completed_at=c6_starts + timedelta(hours=1, minutes=55),
            )
        )

        # Booking 3: In Progress currently
        b6_3 = Booking(
            camp_id=camp6.id,
            resident_id=users_by_username["res_bg_3"].id,
            status="in_progress",
            quoted_price_paise=119900,
            final_price_paise=95900,
            slot_starts_at=c6_starts + timedelta(hours=2),
        )
        session.add(b6_3)
        session.flush()
        session.add(
            JobRecord(
                booking_id=b6_3.id,
                vendor_id=users_by_username["vendor_pro"].id,
                before_photo_path="uploads/demo/pest_before_3.jpg",
                after_photo_path=None,
                started_at=c6_starts + timedelta(hours=2),
                completed_at=None,
            )
        )

        # Booking 4: Scheduled for upcoming slot
        session.add(
            Booking(
                camp_id=camp6.id,
                resident_id=users_by_username["res_bg_4"].id,
                status="scheduled",
                quoted_price_paise=119900,
                final_price_paise=95900,
                slot_starts_at=c6_starts + timedelta(hours=3),
            )
        )
        print("  + Created Camp 6: Society Monsoon Fogging & Spray (IN PROGRESS)")

        # CAMP 7: Completed (Full camp archive, 5 homes, 30% top tier discount unlocked)
        c7_starts = now - timedelta(days=5)
        c7_ends = c7_starts + timedelta(hours=7, minutes=30)
        c7_deadline = c7_starts - timedelta(days=2)
        camp7 = Camp(
            society_id=societies_by_code["SUNRISE-DEMO"].id,
            service_id=services_by_code["deep_cleaning"].id,
            title="Full Villa & Apartment Deep Scrubbing",
            starts_at=c7_starts,
            ends_at=c7_ends,
            slot_minutes=90,
            min_participants=3,
            max_participants=5,
            join_deadline=c7_deadline,
            base_price_paise=249900,  # ₹2,499
            status="completed",
            vendor_id=users_by_username["vendor_urban"].id,
            created_by=users_by_username["ops_admin"].id,
        )
        session.add(camp7)
        session.flush()
        for min_p, disc in [(1, 0), (3, 20), (5, 30)]:
            session.add(CampPriceTier(camp_id=camp7.id, min_participants=min_p, discount_pct=disc))

        for idx, res_name in enumerate(["res_sh_1", "res_sh_2", "res_sh_3", "res_sh_4", "res_sh_5"]):
            b7 = Booking(
                camp_id=camp7.id,
                resident_id=users_by_username[res_name].id,
                status="completed",
                quoted_price_paise=249900,
                final_price_paise=174900,  # 30% discount applied (₹1,749)
                slot_starts_at=c7_starts + timedelta(minutes=idx * 90),
            )
            session.add(b7)
            session.flush()
            session.add(
                JobRecord(
                    booking_id=b7.id,
                    vendor_id=users_by_username["vendor_urban"].id,
                    before_photo_path=f"uploads/demo/deep_clean_before_{idx+1}.jpg",
                    after_photo_path=f"uploads/demo/deep_clean_after_{idx+1}.jpg",
                    started_at=c7_starts + timedelta(minutes=idx * 90),
                    completed_at=c7_starts + timedelta(minutes=idx * 90 + 80),
                )
            )
        print("  + Created Camp 7: Full Villa & Apartment Deep Scrubbing (COMPLETED)")

        # CAMP 8: Cancelled (Quorum not met, bookings cancelled)
        c8_starts = now - timedelta(days=2)
        c8_ends = c8_starts + timedelta(hours=6)
        c8_deadline = c8_starts - timedelta(days=2)
        camp8 = Camp(
            society_id=societies_by_code["PRESTIGE-DEMO"].id,
            service_id=services_by_code["pest_control"].id,
            title="Balcony Pigeon Netting Drive",
            starts_at=c8_starts,
            ends_at=c8_ends,
            slot_minutes=60,
            min_participants=5,
            max_participants=6,
            join_deadline=c8_deadline,
            base_price_paise=159900,
            status="cancelled",
            cancelled_reason="Minimum participant threshold (5 homes) was not met by the join deadline. All bookings released.",
            vendor_id=None,
            created_by=users_by_username["ops_admin"].id,
        )
        session.add(camp8)
        session.flush()
        for min_p, disc in [(1, 0), (5, 20)]:
            session.add(CampPriceTier(camp_id=camp8.id, min_participants=min_p, discount_pct=disc))

        for res_name in ["res_pl_1", "res_pl_2"]:
            session.add(
                Booking(
                    camp_id=camp8.id,
                    resident_id=users_by_username[res_name].id,
                    status="cancelled",
                    quoted_price_paise=159900,
                    cancelled_at=c8_deadline,
                )
            )
        print("  + Created Camp 8: Balcony Pigeon Netting Drive (CANCELLED)")

        session.commit()
        print("\n✅ Domora Operations Demo Seeding completed successfully!")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("📊 SEEDED DATA SUMMARY:")
        print("  • 4 Societies (Sunrise Heights, Prestige Lakeside, Sobha Forest, Brigade Gateway)")
        print("  • 4 Service Categories (Pest Control, AC Servicing, Deep Cleaning, Sofa Shampoo)")
        print("  • 3 Active Vendors (Apex Facilities, CoolBreeze AC, Urban Sparkle)")
        print("  • 16 Sample Residents with realistic apartment units & phone numbers")
        print("  • 8 Camps across all 5 lifecycle states (3 Open [Critical, Warning, Healthy], 1 Confirmed, 1 In Progress, 1 Completed, 1 Cancelled)")
        print("  • 26 Active Bookings + 2 Cancelled Bookings with slot assignments & job records")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔑 LOGIN CREDENTIALS:")
        print("  Ops Role:      username='ops_admin'    password='DomoraOpsDemo2026!'")
        print("  Vendor Role:   username='vendor_pro'   password='DomoraVendorDemo2026!'")
        print("  Resident Role: username='resident_demo' password='Password123!'")
        print("  Sample Users:  password='DomoraDemo2026!'")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")


if __name__ == "__main__":
    seed_ops_demo()
